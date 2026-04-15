use llamasweeper_rust::board_gen_8way::Board;
use rayon::prelude::*;
use std::cell::RefCell;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;
use thread_local::ThreadLocal;

const MAX_SCORE: usize = 400;
const DEFAULT_TOTAL: usize = 100_000_000;
const DEFAULT_CHUNK: usize = 100_000;
const NUM_THREADS: usize = 5;

struct Preset {
    name: &'static str,
    width: usize,
    height: usize,
    mines: usize,
}

const PRESETS: [Preset; 3] = [
    Preset { name: "beg", width: 9,  height: 9,  mines: 10 },
    Preset { name: "int", width: 16, height: 16, mines: 40 },
    Preset { name: "exp", width: 30, height: 16, mines: 99 },
];

fn csv_filename(width: usize, height: usize, mines: usize) -> String {
    format!("distribution_{}x{}_{}.csv", width, height, mines)
}

/// Read existing CSV and return (boards_generated, [3bv_counts; 400], [zini_counts; 400])
fn read_csv(path: &str) -> Option<(usize, Vec<usize>, Vec<usize>)> {
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    // First line: boards_generated,<number>
    let first_line = lines.next()?.ok()?;
    let boards_generated: usize = first_line
        .split(',')
        .nth(1)?
        .trim()
        .parse()
        .ok()?;

    // Second line: header row (skip)
    let _ = lines.next()?;

    let mut bbbv_counts = vec![0usize; MAX_SCORE];
    let mut zini_counts = vec![0usize; MAX_SCORE];

    for line in lines {
        let line = line.ok()?;
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 3 {
            continue;
        }
        let score: usize = parts[0].trim().parse().ok()?;
        let bbbv: usize = parts[1].trim().parse().ok()?;
        let zini: usize = parts[2].trim().parse().ok()?;
        if score < MAX_SCORE {
            bbbv_counts[score] = bbbv;
            zini_counts[score] = zini;
        }
    }

    Some((boards_generated, bbbv_counts, zini_counts))
}

/// Write CSV with current state
fn write_csv(
    path: &str,
    boards_generated: usize,
    bbbv_counts: &[usize],
    zini_counts: &[usize],
) -> std::io::Result<()> {
    // Write to a temp file first, then rename for atomic checkpoint
    let tmp_path = format!("{}.tmp", path);
    {
        let mut file = fs::File::create(&tmp_path)?;
        writeln!(file, "boards_generated,{}", boards_generated)?;
        writeln!(file, "score,3bv_count,zini_count")?;
        for i in 0..MAX_SCORE {
            writeln!(file, "{},{},{}", i, bbbv_counts[i], zini_counts[i])?;
        }
        file.flush()?;
    }
    fs::rename(&tmp_path, path)?;
    Ok(())
}

fn format_duration(secs: f64) -> String {
    let h = (secs / 3600.0) as u64;
    let m = ((secs % 3600.0) / 60.0) as u64;
    let s = (secs % 60.0) as u64;
    if h > 0 {
        format!("{}h {:02}m {:02}s", h, m, s)
    } else if m > 0 {
        format!("{}m {:02}s", m, s)
    } else {
        format!("{}s", s)
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: generate_distribution <preset> [total_boards] [chunk_size]");
        eprintln!("  preset: beg (9x9, 10 mines), int (16x16, 40 mines), exp (30x16, 99 mines)");
        eprintln!("  total_boards: default {}", DEFAULT_TOTAL);
        eprintln!("  chunk_size: default {}", DEFAULT_CHUNK);
        std::process::exit(1);
    }

    let preset_name = &args[1];
    let preset = PRESETS.iter().find(|p| p.name == preset_name);
    let preset = match preset {
        Some(p) => p,
        None => {
            eprintln!("Unknown preset '{}'. Use: beg, int, exp", preset_name);
            std::process::exit(1);
        }
    };

    let total: usize = args.get(2)
        .and_then(|s| s.replace("_", "").parse().ok())
        .unwrap_or(DEFAULT_TOTAL);

    let chunk_size: usize = args.get(3)
        .and_then(|s| s.replace("_", "").parse().ok())
        .unwrap_or(DEFAULT_CHUNK);

    let (width, height, mines) = (preset.width, preset.height, preset.mines);
    let csv_path = csv_filename(width, height, mines);

    // Try to resume from existing CSV
    let (mut boards_generated, mut bbbv_counts, mut zini_counts) =
        match read_csv(&csv_path) {
            Some((gen, bbbv, zini)) => {
                println!("Resuming from existing CSV: {} boards already generated", gen);
                (gen, bbbv, zini)
            }
            None => {
                println!("Starting fresh — no existing CSV found");
                (0, vec![0usize; MAX_SCORE], vec![0usize; MAX_SCORE])
            }
        };

    if boards_generated >= total {
        println!("Already generated {} boards (target: {}). Nothing to do.", boards_generated, total);
        return;
    }

    let remaining = total - boards_generated;

    println!(
        "Config: {}x{} with {} mines, {} threads",
        width, height, mines, NUM_THREADS
    );
    println!(
        "Target: {} total boards ({} remaining, chunks of {})",
        total, remaining, chunk_size
    );
    println!();

    // Configure rayon thread pool
    rayon::ThreadPoolBuilder::new()
        .num_threads(NUM_THREADS)
        .build_global()
        .expect("Failed to configure rayon thread pool");

    let start_time = Instant::now();
    let start_boards = boards_generated;

    // Thread-local boards for reuse (avoids re-allocation per iteration)
    let tl_board: ThreadLocal<RefCell<Board>> = ThreadLocal::new();

    // Process in chunks for periodic checkpointing
    while boards_generated < total {
        let this_chunk = std::cmp::min(chunk_size, total - boards_generated);

        // Shared atomic arrays for accumulation (avoids per-thread Vec allocation + merge)
        let chunk_bbbv: Vec<AtomicUsize> = (0..MAX_SCORE).map(|_| AtomicUsize::new(0)).collect();
        let chunk_zini: Vec<AtomicUsize> = (0..MAX_SCORE).map(|_| AtomicUsize::new(0)).collect();

        (0..this_chunk).into_par_iter().for_each(|_| {
            let board_cell = tl_board.get_or(|| {
                RefCell::new(
                    Board::new(width, height, mines).expect("Failed to create board"),
                )
            });

            let mut board = board_cell.borrow_mut();
            board.add_mines();
            board.initialize_all().expect("Error initializing board");
            board
                .calculate_zini_8way_small(false)
                .expect("Error calculating ZINI");

            let bbbv = board.info.bbbv as usize;
            let zini = board.info.zini as usize;

            if bbbv < MAX_SCORE {
                chunk_bbbv[bbbv].fetch_add(1, Ordering::Relaxed);
            }
            if zini < MAX_SCORE {
                chunk_zini[zini].fetch_add(1, Ordering::Relaxed);
            }

            board.reset();
        });

        // Merge chunk results into global accumulators
        for i in 0..MAX_SCORE {
            bbbv_counts[i] += chunk_bbbv[i].load(Ordering::Relaxed);
            zini_counts[i] += chunk_zini[i].load(Ordering::Relaxed);
        }
        boards_generated += this_chunk;

        // Checkpoint: write CSV
        write_csv(&csv_path, boards_generated, &bbbv_counts, &zini_counts)
            .expect("Failed to write CSV");

        // Progress
        let elapsed = start_time.elapsed().as_secs_f64();
        let boards_this_run = boards_generated - start_boards;
        let rate = boards_this_run as f64 / elapsed;
        let remaining_boards = total - boards_generated;
        let eta = if rate > 0.0 {
            remaining_boards as f64 / rate
        } else {
            0.0
        };
        let pct = (boards_generated as f64 / total as f64) * 100.0;

        print!(
            "\r[{}] {}/{} ({:.1}%) — {:.0} boards/s — ETA: {}    ",
            format_duration(elapsed),
            boards_generated,
            total,
            pct,
            rate,
            format_duration(eta),
        );
        std::io::stdout().flush().ok();
    }

    println!();
    let elapsed = start_time.elapsed().as_secs_f64();
    let boards_this_run = boards_generated - start_boards;
    let rate = boards_this_run as f64 / elapsed;
    println!();
    println!("Done! Generated {} boards in {}", boards_this_run, format_duration(elapsed));
    println!("Average rate: {:.0} boards/s", rate);
    println!("CSV written to: {}", csv_path);
}
