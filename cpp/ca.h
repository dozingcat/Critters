#pragma once

#include <vector>

namespace Critters {

enum class BlockAction {
    NOOP,
    INVERT,
    ROTATE_90,
    ROTATE_180,
    ROTATE_270,
};

class MargolusCA {
public:
    MargolusCA(uint32_t num_rows, uint32_t num_cols);
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

protected:
    bool use_even_grid() const;

    inline bool at_index(uint32_t i) const {return m_grid[i];}

    virtual BlockAction action_for_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right) = 0;

private:
    uint32_t m_num_rows;
    uint32_t m_num_cols;
    int64_t m_frame_number;
    bool m_reversed;
    uint32_t m_num_threads = 1;
    std::vector<uint8_t> m_grid;
    std::vector<uint8_t> m_scratch_grid;

    inline uint32_t index_for_rc(uint32_t row, uint32_t col) const {return row * num_cols() + col;}

    void update_grid(uint32_t start_row, uint32_t start_col, uint32_t end_row, uint32_t end_col);
    void update_2x2_block(
        uint32_t top_left, uint32_t top_right, uint32_t bottom_left, uint32_t bottom_right);
};

// https://en.wikipedia.org/wiki/Critters_(block_cellular_automaton)
// We use the variation that has different transitions for even and odd frames.
// This preserves the number of active cells.
class CrittersCA : public MargolusCA {
public:
    CrittersCA(uint32_t num_rows, uint32_t num_cols) : MargolusCA(num_rows, num_cols) {}

protected:
    virtual BlockAction action_for_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right);
};

// https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Synchronization
// The "official" Tron rule inverts a block if none or all of the cells are active.
// That causes lots of flashing, so we do the opposite and invert if between 1 and 3
// are active. This is equivalent to applying the none/all rule and then inverting the
// entire grid, so the overall behavior is the same.
class TronCA : public MargolusCA {
public:
    TronCA(uint32_t num_rows, uint32_t num_cols) : MargolusCA(num_rows, num_cols) {}

protected:
    virtual BlockAction action_for_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right);
};

// https://www.mitpressjournals.org/doi/abs/10.1162/978-0-262-32621-6-ch084
class HighlanderCA : public MargolusCA {
public:
    HighlanderCA(uint32_t num_rows, uint32_t num_cols) : MargolusCA(num_rows, num_cols) {}

protected:
    virtual BlockAction action_for_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right);
};

// https://en.wikipedia.org/wiki/Reversible_cellular_automaton#Billiard_ball_computation_and_low-power_computing
// http://fab.cba.mit.edu/classes/862.16/notes/computation/Margolus-1984.pdf
class BilliardBallCA : public MargolusCA {
public:
    BilliardBallCA(uint32_t num_rows, uint32_t num_cols) : MargolusCA(num_rows, num_cols) {}

protected:
    virtual BlockAction action_for_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right);
};

// https://web.mit.edu/lrs/www/physCA/
class SchaefferCA : public MargolusCA {
public:
    SchaefferCA(uint32_t num_rows, uint32_t num_cols) : MargolusCA(num_rows, num_cols) {}

protected:
    virtual BlockAction action_for_block(
        uint32_t top_left, uint32_t top_right,
        uint32_t bottom_left, uint32_t bottom_right);
};

}  // namespace
