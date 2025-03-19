#ifndef ENCRYPT_H_
#include "asconCore.hpp"
#include "asconConstants.hpp"
#include "asconPrintstate.hpp"
#include <stdlib.h>
#include <time.h>

namespace Ascon {
int crypto_aead_encrypt(unsigned char* ciphertext, unsigned long long* ciphertext_len,
                        const unsigned char* message, unsigned long long message_len,
                        const unsigned char* associated_data, unsigned long long associated_data_len,
                        const unsigned char* nsec, const unsigned char* nonce,
                        const unsigned char* key);
void generate_nonce(unsigned char nonce[ASCON_NONCE_SIZE]);
}
#endif