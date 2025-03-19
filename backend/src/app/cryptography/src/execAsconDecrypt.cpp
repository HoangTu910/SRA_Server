#include <iostream>
#include <sstream>
#include <iomanip>
#include <vector>
#include <string>
#include <cstdlib>
#include "asconDecrypt.hpp"

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
    if (argc < 4)
    {
        std::cerr << "Usage: " << argv[0] << " <ciphertextHex> <nonceHex> <keyHex>" << std::endl;
        return 1;
    }

    std::string ciphertextHex(argv[1]);
    std::string nonceHex(argv[2]);
    std::string keyHex(argv[3]);

    // Convert hex strings to byte vectors.
    std::vector<unsigned char> ciphertext = hexToBytes(ciphertextHex);
    std::vector<unsigned char> nonce = hexToBytes(nonceHex);
    std::vector<unsigned char> key = hexToBytes(keyHex);

    // Check if ciphertext contains at least an auth tag (16 bytes)
    if (ciphertext.size() < 16)
    {
        std::cerr << "Error: Ciphertext too short to contain an auth tag!" << std::endl;
        return 1;
    }

    for(int i = 0; i < key.size(); i++) {
        key[i] ^= private_key_for_generate[i % PRIVATE_GENERATE];
    }

    // Extract the last 16 bytes as the auth tag
    std::vector<unsigned char> authTag(ciphertext.end() - 16, ciphertext.end());

    std::vector<unsigned char> plaintext(ciphertext.size());
    unsigned long long plaintextLen = 0;

    // Call the decryption function.
    const unsigned char *associatedData = (const unsigned char *)"DeslabAIoT0x910";

    int ret = Ascon::crypto_aead_decrypt(
        plaintext.data(),  // m: pointer to plaintext output
        &plaintextLen,     // mlen: pointer to plaintext length
        nullptr,           // nsec: optional secret data (often unused)
        ciphertext.data(), // c: ciphertext
        ciphertext.size(), // clen: ciphertext length
        associatedData,    // ad: associated data pointer (not needed here)
        16,                // adlen: associated data length (0)
        nonce.data(),      // npub: nonce
        key.data()         // k: key
    );

    if (ret != 0)
    {
        std::cerr << "Decryption failed" << std::endl;
        return 1;
    }

    // Convert plaintext to a hex string for output.
    std::ostringstream plaintextHexStream;
    for (unsigned long long i = 0; i < plaintextLen; i++)
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
    std::cout << "Decrypted Text: " << plaintextHexStream.str() << std::endl;
    std::cout << "Auth Tag: " << authTagHexStream.str() << std::endl;

    return 0;
}
