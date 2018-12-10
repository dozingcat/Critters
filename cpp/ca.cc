#include <algorithm>
#include <array>
#include <iostream>
#include <map>
#include <set>
#include <thread>
#include <utility>

#include "ca.h"

namespace Critters {

// Optimization for getting the bits of integers between 0 and 15.
const auto INTEGER_BITS = std::array<std::array<uint8_t, 4>, 16> {{
    {0, 0, 0, 0},
    {0, 0, 0, 1},
    {0, 0, 1, 0},
    {0, 0, 1, 1},
    {0, 1, 0, 0},
    {0, 1, 0, 1},
    {0, 1, 1, 0},
    {0, 1, 1, 1},
    {1, 0, 0, 0},
    {1, 0, 0, 1},
    {1, 0, 1, 0},
    {1, 0, 1, 1},
    {1, 1, 0, 0},
    {1, 1, 0, 1},
    {1, 1, 1, 0},
    {1, 1, 1, 1},
}};

const auto HEX_DIGIT_MAP = std::map<char, int> {
    {'0', 0}, {'1', 1}, {'2', 2}, {'3', 3}, {'4', 4}, {'5', 5}, {'6', 6}, {'7', 7},
    {'8', 8}, {'9', 9}, {'A', 10}, {'B', 11}, {'C', 12}, {'D', 13}, {'E', 14}, {'F', 15},
};

StateArray verify_and_invert(const StateArray& states) {
    std::set<uint16_t> used;
    uint32_t index = 0;
    StateArray inverse;
    for (const uint32_t s : states) {
        if (s >= states.size()) {
            throw std::range_error("state index out of bounds");
        }
        if (used.count(s)) {
            throw std::invalid_argument("duplicate state index");
        }
        used.insert(s);
        inverse[s] = index;
        index++;
    }
    return inverse;
}

StateArray array_for_hex(const std::string& hex) {
    if (hex.size() != 16) {
        throw std::invalid_argument("string must have length of 16");
    }
    StateArray arr;
    for (uint32_t i = 0; i < hex.size(); i++) {
        char ch = std::toupper(hex[i]);
        if (!HEX_DIGIT_MAP.count(ch)) {
            throw std::invalid_argument("invalid hex digit");
        }
        arr[i] = HEX_DIGIT_MAP.at(ch);
    }
    return arr;
}

TransitionTable::TransitionTable(const StateArray& even_forward, const StateArray& odd_forward) {
    m_even_forward = even_forward;
    m_even_backward = verify_and_invert(even_forward);
    m_odd_forward = odd_forward;
    m_odd_backward = verify_and_invert(odd_forward);
}

/* static */ std::shared_ptr<TransitionTable> TransitionTable::fromHex(const std::string& hex) {
    switch (hex.size()) {
        case 16: {
            StateArray arr = array_for_hex(hex);
            return std::make_shared<TransitionTable>(arr);
        }
        case 32: {
            StateArray even = array_for_hex(hex.substr(0, 16));
            StateArray odd = array_for_hex(hex.substr(16, 16));
            return std::make_shared<TransitionTable>(even, odd);
        }
        default:
            throw std::invalid_argument("hex string must have length of 16 or 32");
    }
}

uint32_t TransitionTable::next_block_state(
        bool use_even_grid, bool is_forward,
        bool top_left, bool top_right, bool bottom_left, bool bottom_right) const {
    uint32_t index = (top_left << 3) | (top_right << 2) | (bottom_left << 1) | (bottom_right);
    const StateArray& table = use_even_grid ?
        (is_forward ? m_even_forward : m_even_backward) :
        (is_forward ? m_odd_forward : m_odd_backward);
    return table[index];
}

MargolusCA::MargolusCA(
        uint32_t num_rows, uint32_t num_cols, std::shared_ptr<TransitionTable> transition_table) {
    m_num_rows = num_rows;
    m_num_cols = num_cols;
    m_transition_table = transition_table;
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

void MargolusCA::update_2x2_block(bool is_even,
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right) {
    uint32_t state_index = m_transition_table->next_block_state(is_even, !is_reversed(),
        m_grid[top_left], m_grid[top_right], m_grid[bottom_left], m_grid[bottom_right]);
    auto next_states = INTEGER_BITS[state_index];
    m_scratch_grid[top_left] = next_states[0];
    m_scratch_grid[top_right] = next_states[1];
    m_scratch_grid[bottom_left] = next_states[2];
    m_scratch_grid[bottom_right] = next_states[3];
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
            update_2x2_block(!odd_grid,
                offset, offset + 1,
                offset + num_cols(), offset + num_cols() + 1);
        }
    }
    if (has_bottom_edge) {
        // Along bottom row, wrapping to top.
        uint32_t lastrow_offset = num_cols() * (num_rows() - 1);
        for (uint32_t c = start_col; c < end_col; c += 2) {
            update_2x2_block(!odd_grid,
                lastrow_offset + c, lastrow_offset + c + 1,
                c, c + 1);
        }
    }
    if (has_right_edge) {
        // Along right edge, wrapping to left.
        for (uint32_t r = start_row; r < end_row; r += 2) {
            uint32_t row_offset = r * num_cols();
            update_2x2_block(!odd_grid,
                row_offset + num_cols() - 1, row_offset,
                row_offset + 2 * num_cols() - 1, row_offset + num_cols());
        }
    }
    if (has_bottom_edge && has_right_edge) {
        // "Top left" at bottom right, wrapping to the other corners.
        update_2x2_block(!odd_grid,
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

}  // namespace
