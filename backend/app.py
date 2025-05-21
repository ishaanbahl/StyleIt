from dotenv import load_dotenv
load_dotenv() # Load environment variables from .env file

from flask import Flask, request, render_template, send_file, url_for, jsonify
from flask_cors import CORS # Import CORS
import os
import requests # ADDED: For making HTTP requests to OpenWeatherMap
from werkzeug.utils import secure_filename
from rembg import remove
import io
import uuid # To generate unique filenames

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Define base directory relative to this script
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB limit

# Ensure upload and output directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# --- API Endpoint for Background Removal ---
@app.route('/api/remove-background', methods=['POST'])
def handle_remove_background():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        filename = secure_filename(file.filename)
        # Generate a unique filename to avoid overwrites and simplify cleanup
        unique_id = uuid.uuid4()
        base, ext = os.path.splitext(filename)
        # Keep original extension for input, force PNG for output
        input_filename = f"{unique_id}{ext}"
        output_filename = f"no_bg_{unique_id}.png"

        input_path = os.path.join(app.config['UPLOAD_FOLDER'], input_filename)
        output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)

        try:
            file.save(input_path)

            # --- Background Removal Logic ---
            with open(input_path, 'rb') as i:
                input_data = i.read()
                output_data = remove(input_data)

            # Save the processed image (which is PNG)
            with open(output_path, 'wb') as o:
                o.write(output_data)
            # --- End Background Removal ---

            # Clean up the original uploaded file
            os.remove(input_path)

            # Return the URL to the processed image
            # Use url_for which requires the correct endpoint name
            output_url = url_for('get_output_file', filename=output_filename, _external=True)
            return jsonify({"output_url": output_url}), 200

        except Exception as e:
            app.logger.error(f"Error processing image '{filename}': {e}")
            # Clean up potentially corrupted/failed files
            if os.path.exists(input_path):
                os.remove(input_path)
            if os.path.exists(output_path):
                os.remove(output_path)
            return jsonify({"error": f"Failed to process image. {str(e)}"}), 500

    return jsonify({"error": "Invalid file"}), 400

# --- Endpoint to Serve Processed Files ---
@app.route('/outputs/<filename>')
def get_output_file(filename):
    # Security: Basic check to prevent directory traversal
    # Also ensure it's one of our generated files
    if '..' in filename or filename.startswith('/') or not filename.startswith('no_bg_') or not filename.endswith('.png'):
        return "Invalid filename", 400

    safe_path = os.path.join(app.config['OUTPUT_FOLDER'], filename)
    if os.path.exists(safe_path):
        return send_file(safe_path, mimetype='image/png')
    else:
        return "File not found", 404

# --- ADDED: New API Endpoint for Weather Data ---
@app.route('/api/get_weather', methods=['GET'])
def get_weather_data():
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    
    # Retrieve the API key from an environment variable
    api_key = os.environ.get('OPENWEATHERMAP_API_KEY')

    if not api_key:
        app.logger.error("OpenWeatherMap API key not found in environment variables.")
        return jsonify({"error": "Weather API key not configured on server"}), 500
    
    if not latitude or not longitude:
        return jsonify({"error": "Latitude and longitude parameters are required"}), 400

    try:
        openweathermap_url = f"https://api.openweathermap.org/data/2.5/weather?lat={latitude}&lon={longitude}&appid={api_key}&units=metric"
        
        response = requests.get(openweathermap_url)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        
        weather_data = response.json()
        return jsonify(weather_data)
        
    except requests.exceptions.HTTPError as http_err:
        error_message = f"HTTP error occurred while fetching weather: {http_err}"
        status_code = response.status_code if response else 503 # Service unavailable if no response
        try:
            # Try to get error details from OpenWeatherMap if available
            openweathermap_error_details = response.json()
        except ValueError: # If response is not JSON
            openweathermap_error_details = response.text
        
        app.logger.error(f"{error_message}, Status: {status_code}, Details: {openweathermap_error_details}")
        return jsonify({
            "error": error_message,
            "details": openweathermap_error_details
        }), status_code
    except requests.exceptions.RequestException as req_err: # Other request errors (e.g., connection error)
        error_message = f"Request error occurred while fetching weather: {req_err}"
        app.logger.error(error_message)
        return jsonify({"error": error_message}), 503 # Service Unavailable
    except Exception as e:
        error_message = f"An unexpected error occurred: {e}"
        app.logger.error(error_message)
        return jsonify({"error": error_message}), 500

# --- Optional: HTML page for direct testing (less critical now) ---
@app.route('/', methods=['GET'])
def index():
    # Simple HTML response indicating the backend is running
    return "<h1>Backend is running</h1><p>Use the /api/remove-background endpoint.</p>"

if __name__ == '__main__':
    # Bind to 0.0.0.0 to be accessible from the network (e.g., by your Expo app)
    # Keep debug=True for development, change to False for production
    app.run(host='0.0.0.0', port=5000, debug=True) 
