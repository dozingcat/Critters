#include <algorithm>
#include <iostream>
#include <thread>
#include <utility>

#include "ca.h"

namespace Critters {

MargolusCA::MargolusCA(uint32_t num_rows, uint32_t num_cols) {
    m_num_rows = num_rows;
    m_num_cols = num_cols;
    m_grid.resize(num_cells(), 0);
    m_scratch_grid.resize(num_cells(), 0);
}

bool MargolusCA::at(uint32_t row, uint32_t col) const {
    return m_grid[index_for_rc(row, col)];
}

void MargolusCA::set_cells(const std::vector<std::vector<uint32_t>>& cells, bool active) {
    for (auto& rc : cells) {
        m_grid[index_for_rc(rc[0], rc[1])] = active;
    }
}

std::vector<std::vector<uint32_t>> MargolusCA::get_active_cells() const {
    std::vector<std::vector<uint32_t>> cells;
    for (uint32_t r = 0; r < num_rows(); r++) {
        for (uint32_t c = 0; c < num_cols(); c++) {
            if (at(r, c)) {
                cells.push_back({r, c});
            }
        }
    }
    return cells;
}

void MargolusCA::reset() {
    m_reversed = false;
    m_frame_number = 0;
    std::fill(m_grid.begin(), m_grid.end(), 0);
}

bool MargolusCA::use_even_grid() const {
    return (frame_number() % 2 == 0) != is_reversed();
}

void MargolusCA::update_2x2_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right) {
    switch (action_for_block(top_left, top_right, bottom_left, bottom_right)) {
        case BlockAction::NOOP:
            m_scratch_grid[top_left] = m_grid[top_left];
            m_scratch_grid[top_right] = m_grid[top_right];
            m_scratch_grid[bottom_left] = m_grid[bottom_left];
            m_scratch_grid[bottom_right] = m_grid[bottom_right];
            break;
        case BlockAction::INVERT:
            m_scratch_grid[top_left] = 1 - m_grid[top_left];
            m_scratch_grid[top_right] = 1 - m_grid[top_right];
            m_scratch_grid[bottom_left] = 1 - m_grid[bottom_left];
            m_scratch_grid[bottom_right] = 1 - m_grid[bottom_right];
            break;
        case BlockAction::ROTATE_180:
            m_scratch_grid[top_left] = m_grid[bottom_right];
            m_scratch_grid[top_right] = m_grid[bottom_left];
            m_scratch_grid[bottom_left] = m_grid[top_right];
            m_scratch_grid[bottom_right] = m_grid[top_left];
            break;
        case BlockAction::ROTATE_90:
            m_scratch_grid[top_left] = m_grid[top_right];
            m_scratch_grid[top_right] = m_grid[bottom_right];
            m_scratch_grid[bottom_left] = m_grid[top_left];
            m_scratch_grid[bottom_right] = m_grid[bottom_left];
            break;
        case BlockAction::ROTATE_270:
            m_scratch_grid[top_left] = m_grid[bottom_left];
            m_scratch_grid[top_right] = m_grid[top_left];
            m_scratch_grid[bottom_left] = m_grid[bottom_right];
            m_scratch_grid[bottom_right] = m_grid[top_right];
            break;
    }
}

// All parameters must be even numbers.
void MargolusCA::update_grid(
        uint32_t start_row, uint32_t start_col, uint32_t end_row, uint32_t end_col) {
    // If using odd subgrids, shift the starting position and make sure to not
    // hit the bottom or right edges; those are handled separately.
    bool odd_grid = !use_even_grid();
    if (odd_grid) {
        start_row += 1;
        start_col += 1;
        end_row = std::min(end_row, num_rows() - 1);
        end_col = std::min(end_col, num_cols() - 1);
    }
    bool has_bottom_edge = odd_grid && (end_row == num_rows() - 1);
    bool has_right_edge = odd_grid && (end_col == num_cols() - 1);
    // Interior points.
    for (uint32_t r = start_row; r < end_row; r += 2) {
        uint32_t row_offset = r * num_cols();
        for (uint32_t c = start_col; c < end_col; c += 2) {
            uint32_t offset = row_offset + c;
            update_2x2_block(
                offset, offset + 1,
                offset + num_cols(), offset + num_cols() + 1);
        }
    }
    if (has_bottom_edge) {
        // Along bottom row, wrapping to top.
        uint32_t lastrow_offset = num_cols() * (num_rows() - 1);
        for (uint32_t c = start_col; c < end_col; c += 2) {
            update_2x2_block(
                lastrow_offset + c, lastrow_offset + c + 1,
                c, c + 1);
        }
    }
    if (has_right_edge) {
        // Along right edge, wrapping to left.
        for (uint32_t r = start_row; r < end_row; r += 2) {
            uint32_t row_offset = r * num_cols();
            update_2x2_block(
                row_offset + num_cols() - 1, row_offset,
                row_offset + 2 * num_cols() - 1, row_offset + num_cols());
        }
    }
    if (has_bottom_edge && has_right_edge) {
        // "Top left" at bottom right, wrapping to the other corners.
        update_2x2_block(
            num_rows() * num_cols() - 1, (num_rows() - 1) * num_cols(),
            num_cols() - 1, 0);
    }
}

// You might think that it would be better to have a thread pool rather than creating
// threads on every call to `tick`. At least in initial testing, it turns out that a
// thread pool is actually slower due to the required synchronization, which also makes the
// code much more complex. For small grids (e.g. 100x100), threads don't help at all.
void MargolusCA::tick() {
    uint32_t nthreads = num_threads();
    if (nthreads <= 1) {
        update_grid(0, 0, num_rows(), num_cols());
    }
    else {
        // Spawn N-1 threads, handling the last batch in the main thread.
        std::vector<std::thread> threads;
        for (uint32_t i = 0; i < nthreads; i++) {
            uint32_t start_row = 2 * (i * (num_rows() / 2) / nthreads);
            uint32_t end_row = 2 * ((i + 1) * (num_rows() / 2) / nthreads);
            if (i < nthreads - 1) {
                std::thread t(
                    [this, start_row, end_row] {update_grid(start_row, 0, end_row, num_cols());});
                threads.push_back(std::move(t));
            }
            else {
                update_grid(start_row, 0, end_row, num_cols());
            }
        }
        for (auto& t : threads) {
            t.join();
        }
    }
    // `m_scratch_grid` now holds the state for the next frame, so swap it with `m_grid`.
    std::swap(m_grid, m_scratch_grid);
    m_frame_number += (is_reversed()) ? -1 : 1;
}


BlockAction CrittersCA::action_for_block(
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right) {
    uint32_t num_alive =
        at_index(top_left) + at_index(top_right) + at_index(bottom_left) + at_index(bottom_right);

    if (num_alive == 2) {
        return BlockAction::INVERT;
    }
    if ((num_alive == 1 && !use_even_grid()) || (num_alive == 3 && use_even_grid())) {
        return BlockAction::ROTATE_180;
    }
    return BlockAction::NOOP;
}

BlockAction TronCA::action_for_block(
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right) {
    uint32_t num_alive =
        at_index(top_left) + at_index(top_right) + at_index(bottom_left) + at_index(bottom_right);
    if (num_alive == 0 || num_alive == 4) {
        return BlockAction::INVERT;
    }
    return BlockAction::NOOP;
}

BlockAction HighlanderCA::action_for_block(
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right) {
    uint32_t num_alive =
        at_index(top_left) + at_index(top_right) + at_index(bottom_left) + at_index(bottom_right);
    switch (num_alive) {
        case 2:
            return BlockAction::INVERT;
        case 1:
            return is_reversed() ? BlockAction::ROTATE_270 : BlockAction::ROTATE_90;
        case 3:
            return is_reversed() ? BlockAction::ROTATE_90 : BlockAction::ROTATE_270;
        default:
            return BlockAction::NOOP;
    }
}

BlockAction BilliardBallCA::action_for_block(
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right) {
    uint32_t num_alive =
        at_index(top_left) + at_index(top_right) + at_index(bottom_left) + at_index(bottom_right);
    if (num_alive == 1) {
        return BlockAction::ROTATE_180;
    }
    if (num_alive == 2 && at_index(top_left) == at_index(bottom_right)) {
        return BlockAction::INVERT;
    }
    return BlockAction::NOOP;
}

BlockAction SchaefferCA::action_for_block(
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right) {
    uint32_t num_alive =
        at_index(top_left) + at_index(top_right) + at_index(bottom_left) + at_index(bottom_right);
    return (num_alive == 1 || num_alive == 2) ? BlockAction::ROTATE_180 : BlockAction::NOOP;
}

}  // namespace
