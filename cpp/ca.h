#pragma once

#include <array>
#include <vector>

namespace Critters {

using StateArray = std::array<uint32_t, 16>;

/**
 * Transition table for a 2x2 block of a cellular automaton using the Margolus neighborhood.
 * On every tick, the grid is divided into 2x2 blocks. On odd ticks, the blocks are shifted
 * one cell vertically and horizontally relative to even ticks. Each block is updated according
 * to a table that maps the four input bits to four output bits. For a reversible cellular
 * automaton, this mapping must be one-to-one, so that every possible output is produced by
 * exactly one input. There can be separate mappings for even and odd ticks.
 */
class TransitionTable {
public:
    TransitionTable(const StateArray& even_forward, const StateArray& odd_forward);

    TransitionTable(const StateArray& even_forward) :
        TransitionTable(even_forward, even_forward) {};

    /**
     * Returns the next state of a 2x2 block. The returned value is a four bit integer
     * (i.e. between 0 and 15), where the binary digits define the active cells of the next state.
     * The order from most significant to least significant bits is top left, top right,
     * bottom left, and bottom right. For example, a return value of 5 (0b0101) means that the
     * next state should have the top right and bottom right cells enabled.
     */
    uint32_t next_block_state(
        bool use_even_grid, bool is_forward,
        bool top_left, bool top_right, bool bottom_left, bool bottom_right) const;

    // https://en.wikipedia.org/wiki/Critters_(block_cellular_automaton)
    // We use the variation that has different transitions for even and odd frames.
    // This preserves the number of active cells.
    static std::shared_ptr<TransitionTable> CRITTERS() {
        // If two cells are active, invert the block. Rotate a half turn if three cells are active
        // on an even frame, or if one cell is active on an odd frame.
        return std::make_shared<TransitionTable>(
                StateArray {
                    0b0000, 0b0001, 0b0010, 0b1100, 0b0100, 0b1010, 0b1001, 0b1110,
                    0b1000, 0b0110, 0b0101, 0b1101, 0b0011, 0b1011, 0b0111, 0b1111,
                },
                StateArray {
                    0b0000, 0b1000, 0b0100, 0b1100, 0b0010, 0b1010, 0b1001, 0b0111,
                    0b0001, 0b0110, 0b0101, 0b1011, 0b0011, 0b1101, 0b1110, 0b1111,
                });
    }

    // https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Synchronization
    // The "official" Tron rule inverts a block if none or all of the cells are active.
    // That causes lots of flashing, so we do the opposite and invert if between 1 and 3
    // are active. This is equivalent to applying the none/all rule and then inverting the
    // entire grid, so the overall behavior is the same.
    static std::shared_ptr<TransitionTable> TRON(){
        // 0000 and 1111 are unchanged, everything else inverts (i => 15-i).
        return std::make_shared<TransitionTable>(
                StateArray {0, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 15});
    }

    // https://www.mitpressjournals.org/doi/abs/10.1162/978-0-262-32621-6-ch084
    static std::shared_ptr<TransitionTable> HIGHLANDER() {
        // Invert if two cells are active, rotate a quarter turn counterclockwise if one cell is
        // active, rotate a quarter turn clockwise if three cells are active.
        return std::make_shared<TransitionTable>(
                StateArray {
                    0b0000, 0b0100, 0b0001, 0b1100, 0b1000, 0b1010, 0b1001, 0b1011,
                    0b0010, 0b0110, 0b0101, 0b1110, 0b0011, 0b0111, 0b1101, 0b1111,
                });
    }

    // https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Billiard_ball_computation_and_low-power_computing
    // http://fab.cba.mit.edu/classes/862.16/notes/computation/Margolus-1984.pdf
    static std::shared_ptr<TransitionTable> BILLIARD_BALL() {
        // Rotate a half turn if one cell is active. Invert if two cells are active and
        // diagonally opposite.
        return std::make_shared<TransitionTable>(
                StateArray {
                    0b0000, 0b1000, 0b0100, 0b0011, 0b0010, 0b0101, 0b1001, 0b0111,
                    0b0001, 0b0110, 0b1010, 0b1011, 0b1100, 0b1101, 0b1110, 0b1111,
                });
    }

    // https://web.mit.edu/lrs/www/physCA/
    static std::shared_ptr<TransitionTable> SCHAEFFER() {
        // Rotate a half turn if one or two cells are active. (This is a no-op if two active cells
        // are diagonally opposite).
        return std::make_shared<TransitionTable>(
                StateArray {
                    0b0000, 0b1000, 0b0100, 0b1100, 0b0010, 0b1010, 0b0110, 0b0111,
                    0b0001, 0b1001, 0b0101, 0b1011, 0b0011, 0b1101, 0b1110, 0b1111,
                });
    }

private:
    StateArray m_even_forward;
    StateArray m_even_backward;
    StateArray m_odd_forward;
    StateArray m_odd_backward;
};

class MargolusCA {
public:
    MargolusCA(
        uint32_t num_rows, uint32_t num_cols, std::shared_ptr<TransitionTable> transitionTable);
    virtual ~MargolusCA() = default;

    inline uint32_t num_rows() const {return m_num_rows;}
    inline uint32_t num_cols() const {return m_num_cols;}
    inline uint32_t num_cells() const {return m_num_rows * m_num_cols;}

    inline uint32_t num_threads() const {return m_num_threads;}
    inline void set_num_threads(uint32_t nt) {m_num_threads = nt;}

    int64_t frame_number() const {return m_frame_number;}
    void set_frame_number(int64_t fnum) {m_frame_number = fnum;}

    bool is_reversed() const {return m_reversed;}
    void set_reversed(bool r) {m_reversed = r;}

    bool at(uint32_t row, uint32_t col) const;

    void set_cells(const std::vector<std::vector<uint32_t>>& cells, bool active = true);
    std::vector<std::vector<uint32_t>> get_active_cells() const;

    void reset();

    void tick();

private:
    uint32_t m_num_rows;
    uint32_t m_num_cols;
    int64_t m_frame_number;
    bool m_reversed;
    uint32_t m_num_threads = 1;
    std::vector<uint8_t> m_grid;
    std::vector<uint8_t> m_scratch_grid;
    std::shared_ptr<TransitionTable> m_transition_table;

    bool use_even_grid() const;

    inline uint32_t index_for_rc(uint32_t row, uint32_t col) const {return row * num_cols() + col;}

    void update_grid(uint32_t start_row, uint32_t start_col, uint32_t end_row, uint32_t end_col);
    void update_2x2_block(bool is_even,
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right);
};

}  // namespace
