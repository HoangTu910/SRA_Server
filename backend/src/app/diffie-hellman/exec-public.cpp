#include <stdio.h>
#include <time.h>
#include <stdlib.h>
#include <memory.h>
#include "dhexchange.h"

void printKeyHex(DH_KEY key) {
    for (int i = 0; i < DH_KEY_LENGTH; i++) {  
        printf("%02x", key[i]); 
    }
    printf("\n");
}

int main() {
    DH_KEY server_private, server_public;
    
    time_t seed;
    time(&seed);
    srand((unsigned int)seed);

    DH_generate_key_pair(server_public, server_private);

    printf("Public Key: ");
    printKeyHex(server_public);
    
    printf("Private Key: ");
    printKeyHex(server_private);

    return 0;
}
