#include <algorithm>
#include <cctype>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "ca.h"

/**
 * To build:
 *     g++ -std=c++14 -O2 critters.cc ca.cc
 */

using namespace Critters;

namespace {
    struct Options {
        std::string ca_type;
        uint32_t num_rows = 0;
        uint32_t num_cols = 0;
        int64_t start_frame = 0;
        int64_t end_frame = 0;
        uint64_t checkpoint_frames = 0;
        uint32_t num_threads = 0;
    };
}

void usage_error() {
    std::cerr << "Arguments: --rows=R --cols=C (--start=N) (--end=N) (--checkpoint=N) "
              << "(--threads=N) "
              << "(--ca=[critters|tron|highlander|billiardball|schaeffer|singlerotation|(16 or 32 hex chars)])\n";
    std::exit(1);
}

bool starts_with(const std::string& s, const std::string& prefix) {
    return s.length() >= prefix.length() && s.substr(0, prefix.length()) == prefix;
}

std::string string_after_equal_sign(const std::string& s) {
    size_t index = s.find('=');
    return s.substr(index + 1);
}

int64_t int_after_equal_sign(const std::string& s) {
    try {
        return std::stoll(string_after_equal_sign(s));
    }
    catch (std::exception& ex) {
        std::cerr << "Bad argument: " << s << "\n";
        usage_error();
        return 0;
    }
}

Options parse_options(int argc, char** argv) {
    Options opts;
    try {
        for (uint32_t i = 1; i < argc; i++) {
            std::string s {argv[i]};
            // Something like boost::numeric_cast would be better to avoid range issues.
            if (starts_with(s, "--rows=")) {
                opts.num_rows = int_after_equal_sign(s);
            }
            else if (starts_with(s, "--cols=")) {
                opts.num_cols = int_after_equal_sign(s);
            }
            else if (starts_with(s, "--start=")) {
                opts.start_frame = int_after_equal_sign(s);
            }
            else if (starts_with(s, "--end=")) {
                opts.end_frame = int_after_equal_sign(s);
            }
            else if (starts_with(s, "--checkpoint=")) {
                opts.checkpoint_frames = int_after_equal_sign(s);
            }
            else if (starts_with(s, "--threads=")) {
                opts.num_threads = int_after_equal_sign(s);
            }
            else if (starts_with(s, "--ca=")) {
                opts.ca_type = string_after_equal_sign(s);
            }
            else {
                std::cerr << "Unrecognized argument: " << s << "\n";
                usage_error();
            }
        }
    }
    catch (std::exception& ex) {
        usage_error();
    }
    return opts;
}

// Returns a vector of all (nonnegative) ints from the input stream.
// Separators are any non-digit characters. In particular, this will
// read ints from a serialized JSON array.
std::vector<uint32_t> uints_from_stream(std::istream& input) {
    std::vector<uint32_t> result;
    std::string line;
    while (true) {
        std::getline(input, line);
        std::string current_num;
        for (const char ch : line) {
            if (ch >= '0' && ch <= '9') {
                current_num += ch;
            }
            else {
                if (!current_num.empty()) {
                    result.push_back(std::stoi(current_num));
                    current_num.clear();
                }
            }
        }
        if (!current_num.empty()) {
            result.push_back(std::stoi(current_num));
            current_num.clear();
        }
        if (input.eof()) {
            break;
        }
    }
    return result;
}

std::string json_for_cells(const std::vector<std::vector<uint32_t>>& cells) {
    std::ostringstream ss;
    bool first = true;
    ss << "[";
    for (auto& c : cells) {
        if (!first) {
            ss << ", ";
        }
        ss << "[" << c[0] << ", " << c[1] << "]";
        first = false;
    }
    ss << "]";
    return ss.str();
}

std::shared_ptr<TransitionTable> transition_table_for_type(std::string& ca_type) {
    if (ca_type.empty() || ca_type == "critters") {
        return TransitionTable::CRITTERS();
    }
    if (ca_type == "tron") {
        return TransitionTable::TRON();
    }
    if (ca_type == "highlander") {
        return TransitionTable::HIGHLANDER();
    }
    if (ca_type == "billiardball") {
        return TransitionTable::BILLIARD_BALL();
    }
    if (ca_type == "schaeffer") {
        return TransitionTable::SCHAEFFER();
    }
    if (ca_type == "singlerotation") {
        return TransitionTable::SINGLE_ROTATION();
    }
    if (ca_type.size() == 16 || ca_type.size() == 32) {
        return TransitionTable::fromHex(ca_type);
    }
    throw std::logic_error("Unknown CA type");
}

int main(int argc, char** argv) {
    Options opts = parse_options(argc, argv);
    if (!(opts.num_rows > 0 && opts.num_rows % 2 == 0 &&
            opts.num_cols > 0 && opts.num_cols % 2 == 0)) {
        std::cerr << "Bad grid size: " << opts.num_rows << "x" << opts.num_cols << "\n";
        usage_error();
    }
    if (opts.start_frame == opts.end_frame) {
        std::cerr << "Start and end frames are equal (" << opts.start_frame << ")\n";
        usage_error();
    }
    auto nums = uints_from_stream(std::cin);
    uint32_t npairs = nums.size() / 2;
    std::vector<std::vector<uint32_t>> coords;
    for (uint32_t i = 0; i < npairs; i++) {
        coords.push_back({nums[2 * i], nums[2 * i + 1]});
    }

    MargolusCA grid(opts.num_rows, opts.num_cols, transition_table_for_type(opts.ca_type));
    grid.set_num_threads(opts.num_threads);
    grid.set_cells(coords);
    grid.set_frame_number(opts.start_frame);
    grid.set_reversed(opts.end_frame < opts.start_frame);

    while (grid.frame_number() != opts.end_frame) {
        grid.tick();
        if (grid.frame_number() == opts.end_frame || (
                opts.checkpoint_frames > 0 &&
                grid.frame_number() % ((int64_t)opts.checkpoint_frames) == 0)) {

            if (opts.checkpoint_frames > 0) {
                std::cout << "Frame " << grid.frame_number() << "\n";
            }
            std::cout << json_for_cells(grid.get_active_cells()) << "\n";
            std::cout.flush();
        }
    }

    return 0;
}