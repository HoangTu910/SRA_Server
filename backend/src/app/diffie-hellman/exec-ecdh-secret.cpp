#include <iostream>
#include <sstream>
#include <iomanip>
#include <string>
#include <cstdint>
#include <cstdlib>
#include "ecdh.h"

// --- Utility: Convert hex string to byte array ---
// The hex string must be exactly (expectedLen*2) characters long.
bool hexStringToBytes(const std::string &hex, uint8_t *bytes, size_t expectedLen)
{
    for (size_t i = 0; i < expectedLen; i++)
    {
        std::string byteString = hex.substr(i * 2, 2);
        bytes[i] = static_cast<uint8_t>(std::strtoul(byteString.c_str(), nullptr, 16));
    }
    return true;
}

// --- Utility: Convert byte array to hex string ---
std::string bytesToHexString(const uint8_t *bytes, size_t length)
{
    std::ostringstream oss;
    for (size_t i = 0; i < length; i++)
    {
        // Set width=2 and fill with '0' for proper formatting.
        oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(bytes[i]);
    }
    return oss.str();
}

int main()
{
    // Read two hex strings from stdin:
    // First is the private key (your key) and second is the public key from the other party.
    std::string myPrivateHex, anotherPublicHex;
    if (!(std::cin >> myPrivateHex >> anotherPublicHex))
    {
        std::cerr << "Error: Failed to read keys from input." << std::endl;
        return 1;
    }

    uint8_t secret_key[ECC_PUB_KEY_SIZE] = {0};
    uint8_t my_private[ECC_PRV_KEY_SIZE] = {0};
    uint8_t another_public[ECC_PUB_KEY_SIZE] = {0};

    // Convert the hex strings into byte arrays.
    if (!hexStringToBytes(myPrivateHex, my_private, ECC_PRV_KEY_SIZE))
    {
        std::cerr << "Error: Invalid private key hex string." << std::endl;
        return 1;
    }
    if (!hexStringToBytes(anotherPublicHex, another_public, ECC_PUB_KEY_SIZE))
    {
        std::cerr << "Error: Invalid public key hex string." << std::endl;
        return 1;
    }

    ecdh_shared_secret(my_private, another_public, secret_key);

    // Convert the secret key to a hex string and print it.
    std::string secretHex = bytesToHexString(secret_key, ECC_PUB_KEY_SIZE);
    std::cout << secretHex << std::endl;

    return 0;
}
