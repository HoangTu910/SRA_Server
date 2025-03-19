# Compiler
CXX = g++

# Flags
CXXFLAGS = -std=c++11 -Wall

# Source files for each target
SOURCES_DH = dhexchange.cpp exec-public.cpp
SOURCES_PUBLIC = exec-public.cpp

# Output executables
TARGET_DH = dhexchange
TARGET_PUBLIC = exec-public

# Default target
all: $(TARGET_DH) $(TARGET_PUBLIC)

# Build the Diffie-Hellman executable
$(TARGET_DH): dhexchange.cpp exec-public.cpp
	$(CXX) $(CXXFLAGS) -o $(TARGET_DH) $^

# Build the public executable
$(TARGET_PUBLIC): exec-public.cpp
	$(CXX) $(CXXFLAGS) -o $(TARGET_PUBLIC) $^

# Clean rule to remove the generated executables
clean:
	rm -f $(TARGET_DH) $(TARGET_PUBLIC)
