#include "asconHash.hpp"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <vector>
#include <string>
#include <cstdlib>

std::vector<unsigned char> hexToBytes(const std::string &hex) {
    std::vector<unsigned char> bytes;
    if (hex.length() % 2 != 0) {
        throw std::runtime_error("Invalid hex string length");
    }
    for (size_t i = 0; i < hex.length(); i += 2) {
        bytes.push_back(std::stoul(hex.substr(i, 2), nullptr, 16));
    }
    return bytes;
}

int main(int argc, char *argv[]) {
    // Check arguments
    if (argc != 4) {
        std::cerr << "Usage: " << argv[0] << " <master_key_hex> <context> <index>" << std::endl;
        return 1;
    }

    try {
        // Parse inputs
        std::string masterKeyHex(argv[1]);
        std::string context(argv[2]);
        uint32_t index = std::stoul(argv[3]);

        // Convert hex strings to byte vectors
        std::vector<unsigned char> masterKey = hexToBytes(masterKeyHex);
        std::vector<unsigned char> contextByte = hexToBytes(context);

        // Output buffer for derived key (48 bytes)
        std::vector<unsigned char> derivedKey(48);

        // Perform key derivation
        derive_session_key(
            derivedKey.data(),
            derivedKey.size(),
            masterKey.data(),
            masterKey.size(),
            contextByte.data(),
            contextByte.size(),
            index
        );

        // Output derived key in hex format
        for (const auto &byte : derivedKey) {
            std::cout << std::hex << std::setw(2) << std::setfill('0') 
                     << static_cast<int>(byte);
        }
        std::cout << std::endl;

        return 0;

    } catch (const std::exception &e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
}