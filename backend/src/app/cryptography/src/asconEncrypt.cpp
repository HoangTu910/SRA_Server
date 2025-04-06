#include "asconEncrypt.hpp"

namespace Ascon
{
  int crypto_aead_encrypt(unsigned char *ciphertext, unsigned long long *ciphertext_len,
                          const unsigned char *message, unsigned long long message_len,
                          const unsigned char *associated_data, unsigned long long associated_data_len,
                          const unsigned char *nsec, const unsigned char *nonce,
                          const unsigned char *key)
  {
    ascon_state_t state;
    (void)nsec;

    // set ciphertext size
    *ciphertext_len = message_len + CRYPTO_ABYTES;
    //   print("encrypt\n");
    //   printbytes("key", key, CRYPTO_KEYBYTES);
    //   printbytes("nonce", nonce, CRYPTO_NPUBBYTES);
    //   printbytes("associated_data", associated_data, associated_data_len);
    //   printbytes("message", message, message_len);
    ascon_core(&state, ciphertext, message, message_len, associated_data, associated_data_len, nonce, key, ASCON_ENC);
    // get tag
    int i;
    for (i = 0; i < CRYPTO_ABYTES; ++i)
      ciphertext[message_len + i] = *(state.b[3] + i);

    //   printbytes("ciphertext", ciphertext, message_len);
    //   printbytes("tag", ciphertext + message_len, CRYPTO_ABYTES);
    //   print("\n");

    //currently comment
    // printbytes("Ciphertext", ciphertext, message_len);
    // printbytes("Tag", ciphertext + message_len, CRYPTO_ABYTES);
    // PLAT_LOG_D("-- Ascon completed in %.2f ms", elapsed_time);
    return 0;
  }
} // namespace Ascon