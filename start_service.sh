#!/bin/bash

# Function to display a cow saying a message
cow_say() {
    local message=$1
    cowsay "$message"
}

# Function to run nvm and npm in a directory
run_service() {
    local dir=$1
    (
        cd "$dir" || exit
        source ~/.nvm/nvm.sh  # Load nvm
        nvm use 16
        npm start
    )
}

# Array of random messages for the cow to say
random_messages=(
    "Chill bro i'm starting service for you..."
    "Hold up, i'm a cow so it may take some time to run service."
    "What a beautiful day, why don't you go out and stop annoying me?"
    "Cow, cow, cow. Get me some grass and i'll start the service for you."
    "Again?"
    "Jeez! Get AI done the job, why a cow always boot the service for you?"
    "I'm in good mood today, service on the way!"
)

# Pick a random message from the list
random_message=${random_messages[$RANDOM % ${#random_messages[@]}]}

# Start with a friendly message
cow_say "$random_message"

# Start backend service
run_service "./backend" &

# Start broker service
run_service "./broker" &

# Wait for all background jobs to finish
wait
