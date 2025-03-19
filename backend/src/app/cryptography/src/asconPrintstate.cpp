#define ASCON_PRINT_STATE

#ifdef ASCON_PRINT_STATE

#include "asconPrintstate.hpp"
#include "ascon.hpp"

#ifndef WORDTOU64
#define WORDTOU64
#endif

#ifndef U64LE
#define U64LE
#endif

// Print a string using printf
void print(const char *text)
{
    printf("%s", text);
}

// Print bytes in hexadecimal format using printf
void print_bytes(const char *label, const unsigned char *data, size_t len)
{
    char buffer[256]; // Adjust size as needed
    size_t offset = snprintf(buffer, sizeof(buffer), "%s: ", label);
    for (size_t i = 0; i < len && offset < sizeof(buffer) - 3; i++)
    {
        offset += snprintf(buffer + offset, sizeof(buffer) - offset, "%02X", data[i]);
    }
    printf("%s", buffer);
}

#endif