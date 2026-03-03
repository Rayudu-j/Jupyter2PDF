import nbformat
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from nbconvert import HTMLExporter
import os
import webbrowser
from threading import Timer

app = Flask(__name__, static_folder='static', template_folder='templates')
# Enable CORS so the frontend can communicate with the backend
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_notebook():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400
        
    if file and file.filename.endswith('.ipynb'):
        try:
            # Read the notebook content
            notebook_content = nbformat.reads(file.read().decode('utf-8'), as_version=4)
            
            # Initialize the HTML exporter
            html_exporter = HTMLExporter()
            html_exporter.template_name = 'classic' # You can also use 'lab' for JupyterLab styling
            
            # Convert the notebook node to HTML
            (body, resources) = html_exporter.from_notebook_node(notebook_content)
            
            return jsonify({'html': body})
        except Exception as e:
            return jsonify({'error': f'Failed to parse notebook: {str(e)}'}), 500
            
    return jsonify({'error': 'Invalid file format. Please upload a .ipynb file.'}), 400

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")

if __name__ == '__main__':
    # Ensure browser only opens once when using the debug reloader
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        Timer(1, open_browser).start()
    
    # Run the Flask API on port 5000
    app.run(debug=True, port=5000)
