#include <string.h>

#include "asconAPI.hpp"
#include "asconConstants.hpp"
#include "asconLendian.hpp"
#include "asconPermutations.hpp"
#include "asconPrintstate.hpp"

#if ASCON_HASH_BYTES == 32 && ASCON_HASH_ROUNDS == 12
#define IV(i) ASCON_HASH_IV##i
#define PB_START_ROUND 0xf0
#elif ASCON_HASH_BYTES == 32 && ASCON_HASH_ROUNDS == 8
#define IV(i) ASCON_HASHA_IV##i
#define PB_START_ROUND 0xb4
#elif ASCON_HASH_BYTES == 0 && ASCON_HASH_ROUNDS == 12
#define IV(i) ASCON_XOF_IV##i
#define PB_START_ROUND 0xf0
#elif ASCON_HASH_BYTES == 0 && ASCON_HASH_ROUNDS == 8
#define IV(i) ASCON_XOFA_IV##i
#define PB_START_ROUND 0xb4
#endif

#define PA_START_ROUND 0xf0

void derive_session_key(uint8_t* out, uint64_t outlen,
                        const uint8_t* master_key, uint64_t master_key_len,
                        const uint8_t* aad, uint64_t aad_len,
                        uint32_t index);

int crypto_hash(unsigned char* out, const unsigned char* in,
                unsigned long long inlen);