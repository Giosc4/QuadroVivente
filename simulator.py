#!/usr/bin/env python3
"""
ESP32 Simulator for Quadri Viventi
Simulates multiple ESP32 devices sending sensor data to the server
"""

import requests
import json
import time
import random
import math
import threading
import argparse
import sys
from datetime import datetime
from typing import Dict, Any
import uuid

class ESP32Simulator:
    def __init__(self, device_id: str = None, location: str = None, server_url: str = "http://localhost:8000"):
        """
        Initialize ESP32 simulator
        
        Args:
            device_id: Unique device identifier
            location: Device location description
            server_url: Server base URL
        """
        self.device_id = device_id or f"ESP32_{uuid.uuid4().hex[:8]}"
        self.location = location or f"Simulatore_{self.device_id[-4:]}"
        self.server_url = server_url.rstrip('/')
        # CORREZIONE: Endpoint corretto che il server si aspetta
        self.endpoint = f"{self.server_url}/api/devices/data"
        
        # Simulation parameters
        self.is_running = False
        self.send_interval = 1.0  # seconds
        self.error_probability = 0.02  # 2% chance of connection error
        
        # Sensor ranges and base values
        self.sensor_config = {
            'temperature': {
                'min': -10.0,
                'max': 45.0,
                'base': 22.0,
                'noise': 2.0,
                'drift_speed': 0.01
            },
            'humidity': {
                'min': 10.0,
                'max': 95.0,
                'base': 55.0,
                'noise': 5.0,
                'drift_speed': 0.02
            },
            'light': {
                'min': 0,
                'max': 4095,
                'base': 2000,
                'noise': 300,
                'drift_speed': 0.05
            },
            'audio': {
                'min': 0,
                'max': 4095,
                'base': 800,
                'noise': 200,
                'drift_speed': 0.1
            }
        }
        
        # Internal state
        self.current_values = {}
        self.drift_offsets = {}
        self.time_offset = random.uniform(0, 100)  # For sine wave variation
        self.stats = {
            'messages_sent': 0,
            'errors': 0,
            'start_time': None
        }
        
        # Initialize sensor values
        self._reset_sensors()
        
        print(f"🤖 ESP32 Simulator inizializzato:")
        print(f"   Device ID: {self.device_id}")
        print(f"   Location: {self.location}")
        print(f"   Server: {self.server_url}")
        print(f"   Endpoint: {self.endpoint}")

    def _reset_sensors(self):
        """Reset all sensor values to base values"""
        for sensor, config in self.sensor_config.items():
            self.current_values[sensor] = config['base']
            self.drift_offsets[sensor] = 0.0

    def _generate_realistic_temperature(self, elapsed_time: float) -> float:
        """Generate realistic temperature data with daily and seasonal cycles"""
        config = self.sensor_config['temperature']
        base = config['base']
        
        # Daily cycle (24 hour period)
        daily_cycle = 3 * math.sin((elapsed_time + self.time_offset) * 2 * math.pi / 86400)
        
        # Weather variation (slower changes)
        weather_cycle = 2 * math.sin((elapsed_time + self.time_offset) * 2 * math.pi / 3600)
        
        # Random noise
        noise = random.uniform(-config['noise'], config['noise'])
        
        # Gradual drift
        self.drift_offsets['temperature'] += random.uniform(-config['drift_speed'], config['drift_speed'])
        self.drift_offsets['temperature'] = max(-5, min(5, self.drift_offsets['temperature']))
        
        value = base + daily_cycle + weather_cycle + noise + self.drift_offsets['temperature']
        return max(config['min'], min(config['max'], value))

    def _generate_realistic_humidity(self, elapsed_time: float, temperature: float) -> float:
        """Generate realistic humidity data correlated with temperature"""
        config = self.sensor_config['humidity']
        base = config['base']
        
        # Inverse correlation with temperature
        temp_influence = -(temperature - 22) * 1.5
        
        # Daily cycle (humidity usually higher at night)
        daily_cycle = -5 * math.sin((elapsed_time + self.time_offset) * 2 * math.pi / 86400)
        
        # Weather variation
        weather_cycle = 8 * math.sin((elapsed_time + self.time_offset) * 2 * math.pi / 7200)
        
        # Random noise
        noise = random.uniform(-config['noise'], config['noise'])
        
        # Gradual drift
        self.drift_offsets['humidity'] += random.uniform(-config['drift_speed'], config['drift_speed'])
        self.drift_offsets['humidity'] = max(-10, min(10, self.drift_offsets['humidity']))
        
        value = base + temp_influence + daily_cycle + weather_cycle + noise + self.drift_offsets['humidity']
        return max(config['min'], min(config['max'], value))

    def _generate_realistic_light(self, elapsed_time: float) -> int:
        """Generate realistic light data with day/night cycle"""
        config = self.sensor_config['light']
        
        # Day/night cycle (much more pronounced)
        time_of_day = (elapsed_time + self.time_offset) % 86400
        hour = (time_of_day / 3600) % 24
        
        if 6 <= hour <= 18:  # Day time
            # Parabolic curve for daylight
            noon_factor = 1 - abs(hour - 12) / 6
            base_light = config['max'] * 0.2 + (config['max'] * 0.7) * noon_factor
        else:  # Night time
            base_light = config['min'] + random.uniform(0, config['max'] * 0.1)
        
        # Weather clouds effect
        cloud_effect = 0.7 + 0.3 * math.sin((elapsed_time + self.time_offset) * 2 * math.pi / 1800)
        
        # Random noise
        noise = random.uniform(-config['noise'], config['noise'])
        
        # Gradual drift
        self.drift_offsets['light'] += random.uniform(-config['drift_speed'] * 10, config['drift_speed'] * 10)
        self.drift_offsets['light'] = max(-200, min(200, self.drift_offsets['light']))
        
        value = base_light * cloud_effect + noise + self.drift_offsets['light']
        return int(max(config['min'], min(config['max'], value)))

    def _generate_realistic_audio(self, elapsed_time: float) -> int:
        """Generate realistic audio data with activity patterns"""
        config = self.sensor_config['audio']
        base = config['base']
        
        # Activity pattern (more noise during day)
        time_of_day = (elapsed_time + self.time_offset) % 86400
        hour = (time_of_day / 3600) % 24
        
        if 7 <= hour <= 22:  # Active hours
            activity_multiplier = 1.5
        elif 22 <= hour <= 24 or 0 <= hour <= 6:  # Night
            activity_multiplier = 0.3
        else:  # Transition
            activity_multiplier = 1.0
        
        # Random events (sudden noise spikes)
        if random.random() < 0.05:  # 5% chance of noise event
            event_noise = random.uniform(500, 1500)
        else:
            event_noise = 0
        
        # Base ambient noise
        ambient = base * activity_multiplier
        
        # Random variation
        noise = random.uniform(-config['noise'], config['noise'])
        
        # Gradual drift
        self.drift_offsets['audio'] += random.uniform(-config['drift_speed'] * 5, config['drift_speed'] * 5)
        self.drift_offsets['audio'] = max(-100, min(100, self.drift_offsets['audio']))
        
        value = ambient + event_noise + noise + self.drift_offsets['audio']
        return int(max(config['min'], min(config['max'], value)))

    def generate_sensor_data(self) -> Dict[str, Any]:
        """Generate realistic sensor data - FORMATO COMPATIBILE CON IL SERVER"""
        if self.stats['start_time'] is None:
            self.stats['start_time'] = time.time()
        
        elapsed_time = time.time() - self.stats['start_time']
        
        # Generate correlated sensor values
        temperature = self._generate_realistic_temperature(elapsed_time)
        humidity = self._generate_realistic_humidity(elapsed_time, temperature)
        light = self._generate_realistic_light(elapsed_time)
        audio = self._generate_realistic_audio(elapsed_time)
        
        # FORMATO ESATTO che il server si aspetta
        return {
            'device_id': self.device_id,  # Il server cerca sia 'device_id' che 'id'
            'location': self.location,
            'temperature': round(temperature, 1),  # Il server cerca sia 'temperature' che 't'
            'humidity': round(humidity, 1),     # Il server cerca sia 'humidity' che 'h'
            'light': light,                  # Il server cerca sia 'light' che 'l'
            'audio': audio,                  # Il server cerca sia 'audio' che 'a'
            'timestamp': int(time.time() * 1000),
            'mac_address': f"AA:BB:CC:DD:EE:{random.randint(10, 99)}",
            'rssi': random.randint(-80, -30),
            'ip': f"192.168.1.{random.randint(100, 200)}"
        }

    def send_data(self) -> bool:
        """Send sensor data to server"""
        try:
            # Simulate occasional connection errors
            if random.random() < self.error_probability:
                raise requests.exceptions.ConnectionError("Simulated connection error")
            
            data = self.generate_sensor_data()
            
            response = requests.post(
                self.endpoint,
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            if response.status_code == 200:
                self.stats['messages_sent'] += 1
                result = response.json()
                
                if self.stats['messages_sent'] % 10 == 0:  # Print every 10th message
                    print(f"📡 {self.device_id}: T={data['t']}°C, H={data['h']}%, "
                          f"L={data['l']}, A={data['a']} | Sent: {self.stats['messages_sent']}")
                
                return True
            else:
                print(f"❌ {self.device_id}: Server error {response.status_code}: {response.text}")
                self.stats['errors'] += 1
                return False
                
        except requests.exceptions.RequestException as e:
            self.stats['errors'] += 1
            if self.stats['errors'] % 5 == 0:  # Print every 5th error
                print(f"🔌 {self.device_id}: Connection error #{self.stats['errors']}: {e}")
            return False
        except Exception as e:
            self.stats['errors'] += 1
            print(f"💥 {self.device_id}: Unexpected error: {e}")
            return False

    def run_simulation(self):
        """Run the simulation loop"""
        self.is_running = True
        print(f"🚀 Starting simulation for {self.device_id}...")
        
        while self.is_running:
            try:
                self.send_data()
                time.sleep(self.send_interval)
                
            except KeyboardInterrupt:
                print(f"\n⏹️  Stopping simulation for {self.device_id}...")
                break
            except Exception as e:
                print(f"💥 Simulation error for {self.device_id}: {e}")
                time.sleep(5)  # Wait before retrying

    def stop_simulation(self):
        """Stop the simulation"""
        self.is_running = False

    def print_stats(self):
        """Print simulation statistics"""
        runtime = time.time() - (self.stats['start_time'] or time.time())
        success_rate = (self.stats['messages_sent'] / max(1, self.stats['messages_sent'] + self.stats['errors'])) * 100
        
        print(f"\n📊 Statistics for {self.device_id}:")
        print(f"   Runtime: {runtime:.1f} seconds")
        print(f"   Messages sent: {self.stats['messages_sent']}")
        print(f"   Errors: {self.stats['errors']}")
        print(f"   Success rate: {success_rate:.1f}%")
        print(f"   Avg rate: {self.stats['messages_sent'] / max(1, runtime):.1f} msg/sec")

class MultiDeviceSimulator:
    """Simulate multiple ESP32 devices"""
    
    def __init__(self, server_url: str = "http://localhost:8000"):
        self.server_url = server_url
        self.devices = []
        self.threads = []
        
    def add_device(self, device_id: str = None, location: str = None, 
                   interval: float = 1.0, error_prob: float = 0.02):
        """Add a simulated device"""
        device = ESP32Simulator(device_id, location, self.server_url)
        device.send_interval = interval
        device.error_probability = error_prob
        self.devices.append(device)
        return device
    
    def add_preset_devices(self):
        """Add some preset devices with realistic configurations"""
        presets = [
            {
                'device_id': 'ESP32_GIARDINO_01',
                'location': 'Giardino Principale',
                'interval': 1.5,
                'error_prob': 0.01
            },
            {
                'device_id': 'ESP32_SALOTTO_02', 
                'location': 'Salotto Casa',
                'interval': 2.0,
                'error_prob': 0.02
            },
            {
                'device_id': 'ESP32_CUCINA_03',
                'location': 'Cucina',
                'interval': 1.0,
                'error_prob': 0.03
            },
            {
                'device_id': 'ESP32_BALCONE_04',
                'location': 'Balcone Nord',
                'interval': 3.0,
                'error_prob': 0.015
            },
            {
                'device_id': 'ESP32_LABORATORIO_05',
                'location': 'Laboratorio Making',
                'interval': 0.5,
                'error_prob': 0.005
            }
        ]
        
        for preset in presets:
            self.add_device(**preset)
    
    def start_all(self):
        """Start all device simulations in separate threads"""
        print(f"🚀 Starting {len(self.devices)} device simulations...")
        
        for device in self.devices:
            thread = threading.Thread(target=device.run_simulation, daemon=True)
            thread.start()
            self.threads.append(thread)
            time.sleep(0.5)  # Stagger startup
    
    def stop_all(self):
        """Stop all device simulations"""
        print(f"⏹️  Stopping all device simulations...")
        
        for device in self.devices:
            device.stop_simulation()
        
        # Wait for threads to finish
        for thread in self.threads:
            thread.join(timeout=2)
    
    def print_all_stats(self):
        """Print statistics for all devices"""
        print(f"\n📈 Multi-Device Simulation Statistics:")
        print(f"{'='*60}")
        
        for device in self.devices:
            device.print_stats()
            print("-" * 40)

def main():
    """Main function with command line interface"""
    parser = argparse.ArgumentParser(description='ESP32 Simulator for Quadri Viventi')
    parser.add_argument('--server', '-s', default='http://localhost:8000',
                       help='Server URL (default: http://localhost:8000)')
    parser.add_argument('--device-id', '-d', help='Device ID (auto-generated if not specified)')
    parser.add_argument('--location', '-l', help='Device location')
    parser.add_argument('--interval', '-i', type=float, default=1.0,
                       help='Send interval in seconds (default: 1.0)')
    parser.add_argument('--error-rate', '-e', type=float, default=0.02,
                       help='Error probability 0-1 (default: 0.02)')
    parser.add_argument('--multi', '-m', action='store_true',
                       help='Run multiple preset devices')
    parser.add_argument('--count', '-c', type=int, default=5,
                       help='Number of random devices for multi mode (default: 5)')
    
    args = parser.parse_args()
    
    print("🎨 ESP32 Simulator for Quadri Viventi")
    print("=" * 50)
    
    try:
        if args.multi:
            # Multi-device simulation
            simulator = MultiDeviceSimulator(args.server)
            
            if args.count <= 5:
                simulator.add_preset_devices()
            else:
                # Add preset devices first
                simulator.add_preset_devices()
                # Add additional random devices
                for i in range(args.count - 5):
                    simulator.add_device(
                        device_id=f'ESP32_RANDOM_{i+6:02d}',
                        location=f'Random Location {i+6}',
                        interval=random.uniform(0.5, 3.0),
                        error_prob=random.uniform(0.005, 0.05)
                    )
            
            print(f"📡 Running {len(simulator.devices)} devices...")
            simulator.start_all()
            
            try:
                while True:
                    time.sleep(10)
                    # Optional: print periodic stats
                    
            except KeyboardInterrupt:
                print("\n⏹️  Shutting down...")
                simulator.stop_all()
                simulator.print_all_stats()
                
        else:
            # Single device simulation
            device = ESP32Simulator(args.device_id, args.location, args.server)
            device.send_interval = args.interval
            device.error_probability = args.error_rate
            
            try:
                device.run_simulation()
            except KeyboardInterrupt:
                print("\n⏹️  Shutting down...")
            finally:
                device.print_stats()
    
    except Exception as e:
        print(f"💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()