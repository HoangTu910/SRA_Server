#ifndef DECRYPT_H_
#include "asconCore.hpp"
#include "asconPrintstate.hpp"

namespace Ascon {
int crypto_aead_decrypt(unsigned char* m, unsigned long long* mlen,
                        unsigned char* nsec, const unsigned char* c,
                        unsigned long long clen, const unsigned char* ad,
                        unsigned long long adlen, const unsigned char* npub,
                        const unsigned char* k);
}
#endif