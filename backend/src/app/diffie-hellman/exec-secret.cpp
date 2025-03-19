#include <iostream>
#include <sstream>
#include <cstdint>
#include <cstring>
#include <cstdio>
#include "dhexchange.h"

// Convert hexadecimal string to DH_KEY (unsigned char array)
void hex_to_dh_key(const std::string &hex, DH_KEY &key) {
    for (size_t i = 0; i < DH_KEY_LENGTH; ++i) {
        // Extract two characters at a time
        std::string byteString = hex.substr(i * 2, 2);
        // Convert the hex string to an integer
        key[i] = static_cast<unsigned char>(strtol(byteString.c_str(), nullptr, 16));
    }
}

int main() {
    DH_KEY secret_key = {0};
    DH_KEY my_private = {0};
    DH_KEY another_public = {0};

    // Read hexadecimal strings for my_private and another_public from stdin
    std::string my_private_hex, another_public_hex;
    std::cin >> my_private_hex >> another_public_hex;

    // Convert hexadecimal strings to DH_KEY arrays
    hex_to_dh_key(my_private_hex, my_private);
    hex_to_dh_key(another_public_hex, another_public);

    // // Print my_private in hexadecimal format
    // printf("my_private: ");
    // for (int i = 0; i < DH_KEY_LENGTH; ++i) {
    //     printf("%02x", my_private[i]);
    // }
    // printf("\n");

    // // Print another_public in hexadecimal format
    // printf("another_public: ");
    // for (int i = 0; i < DH_KEY_LENGTH; ++i) {
    //     printf("%02x", another_public[i]);
    // }
    // printf("\n");

    // Generate the shared secret key
    DH_generate_key_secret(secret_key, my_private, another_public);

    // Output the secret_key in hexadecimal format
    // printf("secret_key: ");
    for (int i = 0; i < DH_KEY_LENGTH; ++i) {
        printf("%02x", secret_key[i]);
    }
    printf("\n");

    return 0;
}
