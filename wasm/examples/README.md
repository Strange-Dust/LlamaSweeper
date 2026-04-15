# generate_distribution

Multi-threaded tool for generating large-scale 3BV and ZINI score distributions across randomly generated minesweeper boards.

Uses `rayon` with 5 threads (configurable via `NUM_THREADS` constant in the source). Each thread reuses its own `Board` instance to avoid repeated allocation.

## Build

```
cd wasm
cargo build --example generate_distribution --release
```

## Usage

```
cargo run --example generate_distribution --release -- <preset> [total_boards] [chunk_size]
```

| Argument       | Description                                                                         | Default     |
| -------------- | ----------------------------------------------------------------------------------- | ----------- |
| `preset`       | Board size: `beg` (9×9, 10 mines), `int` (16×16, 40 mines), `exp` (30×16, 99 mines) | _required_  |
| `total_boards` | Total number of boards to generate                                                  | 100,000,000 |
| `chunk_size`   | Boards per checkpoint (CSV is saved after each chunk)                               | 100,000     |

Underscores are allowed in numbers (e.g. `100_000_000`).

## Examples

```bash
# Generate 100 million expert boards (default target)
cargo run --example generate_distribution --release -- exp

# Generate 1 million intermediate boards with 50k chunk size
cargo run --example generate_distribution --release -- int 1_000_000 50_000

# Quick test: 10k beginner boards
cargo run --example generate_distribution --release -- beg 10_000
```

## Resume Support

The tool writes a CSV file named `distribution_{W}x{H}_{M}.csv` in the working directory (e.g. `distribution_30x16_99.csv` for expert).

If that file already exists when you run the tool, it reads the existing counts and picks up where it left off. To add more boards, just run again with a higher total:

```bash
# First run — generates 50 million
cargo run --example generate_distribution --release -- exp 50_000_000

# Ctrl+C at any point is safe (data up to the last completed chunk is saved)

# Second run — resumes and generates 50 million more (100M total)
cargo run --example generate_distribution --release -- exp 100_000_000
```

To start over from scratch, delete the CSV file.

## CSV Format

```
boards_generated,10000
score,3bv_count,zini_count
0,0,0
1,0,0
...
125,2,298
126,12,276
...
399,0,0
```

- **Line 1**: metadata — total boards generated so far (used for resume)
- **Line 2**: column headers
- **Lines 3–402**: one row per score value (0–399), with the count of boards that had that 3BV and that ZINI score respectively

The CSV is written atomically (write to `.tmp` then rename) so it won't be corrupted if you kill the process mid-write.

## Performance

Rough rates observed with 5 threads (will vary by CPU):

| Preset | ~Boards/sec |
| ------ | ----------- |
| `beg`  | ~96,000     |
| `exp`  | ~21,000     |

At ~21k/s for expert, 100M boards takes roughly 80 minutes.

## Tuning

To change the thread count, edit the `NUM_THREADS` constant near the top of `examples/generate_distribution.rs`.
