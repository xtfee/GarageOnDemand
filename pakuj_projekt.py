import os

# Nazwa pliku wyjściowego
output_file = 'caly_projekt.txt'

# Foldery i pliki do pominięcia (żeby nie wysyłać śmieci)
ignore_list = {
    '.git', '__pycache__', 'venv', '.idea', '.vscode', 
    'node_modules', '.DS_Store', 'pakuj_projekt.py', 
    output_file, 'db.sqlite3', '*.pyc'
}

def is_text_file(filename):
    # Proste sprawdzenie rozszerzeń, dodaj więcej jeśli potrzebujesz
    valid_extensions = [
        '.py', '.js', '.html', '.css', '.txt', '.md', 
        '.json', '.xml', '.csv', '.sql', '.java', '.c', 
        '.cpp', '.sh', '.bat', '.yml', '.yaml', '.vue', 
        '.ts', '.tsx', '.jsx', '.go', '.rb', '.php', 
        '.swift', '.kt', '.rs', '.dart', '.scala', '.pl', 
        '.lua', '.r', '.m', '.ipynb'
    ]
    return any(filename.endswith(ext) for ext in valid_extensions) or filename == 'Dockerfile' or 'requirements' in filename

with open(output_file, 'w', encoding='utf-8') as outfile:
    for root, dirs, files in os.walk("."):
        # Modyfikacja listy dirs in-place, aby pominąć ignorowane foldery
        dirs[:] = [d for d in dirs if d not in ignore_list]
        
        for file in files:
            if file in ignore_list:
                continue
            
            # Opcjonalnie: filtrujemy tylko pliki tekstowe/kodowe
            if not is_text_file(file):
                continue

            file_path = os.path.join(root, file)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                    
                    # Zapisujemy nagłówek z nazwą pliku
                    outfile.write(f"\n{'='*50}\n")
                    outfile.write(f"PLIK: {file_path}\n")
                    outfile.write(f"{'='*50}\n")
                    outfile.write(content + "\n")
                    print(f"Dodano: {file_path}")
            except Exception as e:
                print(f"Pominięto {file_path} (błąd odczytu: {e})")

print(f"\nGotowe! Cały projekt jest w pliku: {output_file}")