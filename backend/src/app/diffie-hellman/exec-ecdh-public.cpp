/*
  Diffie-Hellman key exchange (without HMAC) aka ECDH_anon in RFC4492


  1. Alice picks a (secret) random natural number 'a', calculates P = a * G and sends P to Bob.
     'a' is Alice's private key.
     'P' is Alice's public key.

  2. Bob picks a (secret) random natural number 'b', calculates Q = b * G and sends Q to Alice.
     'b' is Bob's private key.
     'Q' is Bob's public key.

  3. Alice calculates S = a * Q = a * (b * G).

  4. Bob calculates T = b * P = b * (a * G).

  .. which are the same two values since multiplication in the field is commutative and associative.

  T = S = the new shared secret.


  Pseudo-random number generator inspired / stolen from: http://burtleburtle.net/bob/rand/smallprng.html

*/

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "ecdh.h"

/* pseudo random number generator with 128 bit internal state... probably not suited for cryptographical usage */
typedef struct
{
    uint32_t a;
    uint32_t b;
    uint32_t c;
    uint32_t d;
} prng_t;

static prng_t prng_ctx;

static uint32_t prng_rotate(uint32_t x, uint32_t k)
{
    return (x << k) | (x >> (32 - k));
}

static uint32_t prng_next(void)
{
    uint32_t e = prng_ctx.a - prng_rotate(prng_ctx.b, 27);
    prng_ctx.a = prng_ctx.b ^ prng_rotate(prng_ctx.c, 17);
    prng_ctx.b = prng_ctx.c + prng_ctx.d;
    prng_ctx.c = prng_ctx.d + e;
    prng_ctx.d = e + prng_ctx.a;
    return prng_ctx.d;
}

static void prng_init(uint32_t seed)
{
    uint32_t i;
    prng_ctx.a = 0xf1ea5eed;
    prng_ctx.b = prng_ctx.c = prng_ctx.d = seed;

    for (i = 0; i < 31; ++i)
    {
        (void)prng_next();
    }
}

void printKeyHex(uint8_t key[ECC_PUB_KEY_SIZE])
{
    for (int i = 0; i < ECC_PUB_KEY_SIZE; i++)
    {
        printf("%02x", key[i]);
    }
    printf("\n");
}

void printKeyHexPrivate(uint8_t key[ECC_PRV_KEY_SIZE])
{
    for (int i = 0; i < ECC_PRV_KEY_SIZE; i++)
    {
        printf("%02x", key[i]);
    }
    printf("\n");
}

int main(int argc, char *argv[])
{
    uint8_t server_public[ECC_PUB_KEY_SIZE];
    uint8_t server_private[ECC_PRV_KEY_SIZE];
    static int initialized = 0;
    if (!initialized)
    {
        prng_init((0xbad ^ 0xc0ffee ^ 42) | 0xcafebabe | 666);
        initialized = 1;
    }
    for (int i = 0; i < ECC_PRV_KEY_SIZE; ++i)
    {
        server_private[i] = prng_next();
    }
    ecdh_generate_keys(server_public, server_private);

    printf("Public Key: ");
    printKeyHex(server_public);

    printf("Private Key: ");
    printKeyHexPrivate(server_private);
}
