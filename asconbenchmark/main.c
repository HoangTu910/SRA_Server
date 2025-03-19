#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "api.h"

#define MESSAGE_LEN 2 // 2 bytes of data

// Function to print hexadecimal data
void print_hex(const char *label, const unsigned char *data, size_t len)
{
    printf("%s: ", label);
    for (size_t i = 0; i < len; i++)
    {
        printf("%02x", data[i]);
    }
    printf("\n");
}

int main()
{
    // Test data
    unsigned char message[MESSAGE_LEN] = {0x41, 0x42}; // "AB"
    unsigned char key[CRYPTO_KEYBYTES] = {0};          // Initialize key with zeros
    unsigned char nonce[CRYPTO_NPUBBYTES] = {0};       // Initialize nonce with zeros
    unsigned char ad[0] = {};                          // No associated data
    unsigned long long adlen = 0;

    // Output buffers
    unsigned char ciphertext[MESSAGE_LEN + CRYPTO_ABYTES];
    unsigned char decrypted[MESSAGE_LEN];
    unsigned long long ciphertext_len, decrypted_len;

    // Initialize key and nonce with some values
    for (int i = 0; i < CRYPTO_KEYBYTES; i++)
        key[i] = i;
    for (int i = 0; i < CRYPTO_NPUBBYTES; i++)
        nonce[i] = i;

    // Print test parameters
    print_hex("Original message", message, MESSAGE_LEN);
    print_hex("Key", key, CRYPTO_KEYBYTES);
    print_hex("Nonce", nonce, CRYPTO_NPUBBYTES);

    // Variables for timing
    clock_t start, end;
    double cpu_time_used;

    // Benchmark encryption
    start = clock();
    int encrypt_result = crypto_aead_encrypt(ciphertext, &ciphertext_len,
                                             message, MESSAGE_LEN,
                                             ad, adlen,
                                             NULL, nonce, key);
    end = clock();
    cpu_time_used = ((double)(end - start)) / CLOCKS_PER_SEC;

    printf("\nEncryption time: %.3f ms\n", cpu_time_used * 1000);
    if (encrypt_result != 0)
    {
        printf("Encryption failed!\n");
        return 1;
    }
    print_hex("Ciphertext", ciphertext, ciphertext_len);

    // Benchmark decryption
    start = clock();
    int decrypt_result = crypto_aead_decrypt(decrypted, &decrypted_len,
                                             NULL, ciphertext, ciphertext_len,
                                             ad, adlen,
                                             nonce, key);
    end = clock();
    cpu_time_used = ((double)(end - start)) / CLOCKS_PER_SEC;

    printf("\nDecryption time: %.3f ms\n", cpu_time_used * 1000);
    if (decrypt_result != 0)
    {
        printf("Decryption failed!\n");
        return 1;
    }
    print_hex("Decrypted message", decrypted, decrypted_len);

    // Verify decryption
    if (memcmp(message, decrypted, MESSAGE_LEN) != 0)
    {
        printf("Verification failed! Decrypted message does not match original.\n");
        return 1;
    }
    printf("\nVerification successful! Decrypted message matches original.\n");

    return 0;
}