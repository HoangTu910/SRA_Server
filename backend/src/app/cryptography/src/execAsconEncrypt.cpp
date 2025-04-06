#include <iostream>
#include <sstream>
#include <iomanip>
#include <vector>
#include <string>
#include <cstdlib>
#include "asconEncrypt.hpp" // Assuming this includes encryption functions too

#define PRIVATE_GENERATE 8

std::vector<unsigned char> hexToBytes(const std::string &hex)
{
    std::vector<unsigned char> bytes;
    if (hex.length() % 2 != 0)
    {
        std::cerr << "Invalid hex string (must have even length)." << std::endl;
        exit(1);
    }
    for (size_t i = 0; i < hex.length(); i += 2)
    {
        std::string byteString = hex.substr(i, 2);
        unsigned char byte = static_cast<unsigned char>(std::strtol(byteString.c_str(), nullptr, 16));
        bytes.push_back(byte);
    }
    return bytes;
}

int main(int argc, char *argv[])
{
    uint8_t private_key_for_generate[PRIVATE_GENERATE] = {0xA7, 0x1F, 0x3B, 0xC8, 0x56, 0xE4, 0x92, 0x7D};
    if (argc < 5)
    {
        std::cerr << "Usage: " << argv[0] << " <ciphertextHex> <nonceHex> <keyHex> <associatedDataHex>" << std::endl;
        return 1;
    }

    std::string ciphertextHex(argv[1]); // Ignored in this case (empty)
    std::string nonceHex(argv[2]);
    std::string keyHex(argv[3]);
    std::string associatedDataHex(argv[4]);

    // Convert hex strings to byte vectors
    std::vector<unsigned char> ciphertext = hexToBytes(ciphertextHex); // Will be empty
    std::vector<unsigned char> nonce = hexToBytes(nonceHex);
    std::vector<unsigned char> key = hexToBytes(keyHex);
    std::vector<unsigned char> associatedData = hexToBytes(associatedDataHex);

    // XOR the key with private_key_for_generate
    // for (size_t i = 0; i < key.size(); i++) {
    //     key[i] ^= private_key_for_generate[i % PRIVATE_GENERATE];
    // }

    // Prepare for encryption (no plaintext, only associated data)
    std::vector<unsigned char> plaintext = {}; 
    std::vector<unsigned char> computedCiphertext(16); // Reserve space for auth tag (16 bytes)
    unsigned long long clen = 0;

    // Use ASCON-128a encryption to compute the auth tag
    int ret = Ascon::crypto_aead_encrypt(
        computedCiphertext.data(), // c: output ciphertext (will contain only tag)
        &clen,                     // clen: output ciphertext length
        plaintext.data(),          // m: plaintext (empty)
        plaintext.size(),          // mlen: plaintext length (0)
        associatedData.data(),     // ad: associated data
        associatedData.size(),     // adlen: associated data length
        nullptr,                   // nsec: optional secret data (unused)
        nonce.data(),              // npub: nonce
        key.data()                 // k: key
    );

    if (ret != 0)
    {
        std::cerr << "Encryption failed" << std::endl;
        return 1;
    }

    // Since no plaintext, computedCiphertext contains only the auth tag (16 bytes)
    std::vector<unsigned char> authTag(computedCiphertext.begin(), computedCiphertext.begin() + 16);
    // Convert plaintext (empty) to hex string
    std::ostringstream plaintextHexStream;
    for (unsigned long long i = 0; i < plaintext.size(); i++)
    {
        plaintextHexStream << std::hex << std::setfill('0') << std::setw(2) << (int)plaintext[i];
    }

    // Convert auth tag to hex string
    std::ostringstream authTagHexStream;
    for (const auto &byte : authTag)
    {
        authTagHexStream << std::hex << std::setfill('0') << std::setw(2) << (int)byte;
    }

    // Print results
    std::cout << "Encrypted Text: " << plaintextHexStream.str() << std::endl; // Empty
    std::cout << "Auth Tag: " << authTagHexStream.str() << std::endl;

    return 0;
}