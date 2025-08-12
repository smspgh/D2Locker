#!/usr/bin/env python3
"""
Icon Template Replacer
Recursively scans a directory for SVG and PNG files, analyzes their resolutions,
and replaces them with versions based on input.svg template at the same resolutions.
"""

import os
import sys
import csv
from pathlib import Path
import xml.etree.ElementTree as ET
import re
from PIL import Image, ImageDraw
try:
    import subprocess
    HAS_INKSCAPE = False
    # Check if Inkscape is available
    try:
        subprocess.run(['inkscape', '--version'], capture_output=True, check=True)
        HAS_INKSCAPE = True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
except ImportError:
    HAS_INKSCAPE = False

def get_svg_d2lensions(file_path):
    """Extract d2lensions from SVG file."""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        width = root.get('width')
        height = root.get('height')
        viewbox = root.get('viewBox')
        
        # Try to extract numeric values
        def extract_number(value):
            if not value:
                return None
            # Remove units like px, pt, em, etc.
            match = re.match(r'^([0-9.]+)', str(value))
            return float(match.group(1)) if match else None
        
        w = extract_number(width)
        h = extract_number(height)
        
        # If width/height not found, try viewBox
        if (w is None or h is None) and viewbox:
            try:
                vb_values = viewbox.split()
                if len(vb_values) >= 4:
                    w = float(vb_values[2])
                    h = float(vb_values[3])
            except (ValueError, IndexError):
                pass
        
        if w is not None and h is not None:
            return int(w), int(h)
        else:
            return None, None
            
    except Exception as e:
        return None, None

def get_png_d2lensions(file_path):
    """Extract d2lensions from PNG file."""
    try:
        with Image.open(file_path) as img:
            return img.width, img.height
    except Exception as e:
        return None, None

def create_svg_from_template(template_path, output_path, width, height):
    """Create SVG file from template with specified d2lensions."""
    try:
        tree = ET.parse(template_path)
        root = tree.getroot()
        
        # Update d2lensions
        root.set('width', str(width))
        root.set('height', str(height))
        
        # Update viewBox if it exists, otherwise create one
        viewbox = root.get('viewBox')
        if viewbox:
            # Parse existing viewBox and update width/height
            vb_parts = viewbox.split()
            if len(vb_parts) >= 4:
                root.set('viewBox', f"{vb_parts[0]} {vb_parts[1]} {width} {height}")
        else:
            # Create new viewBox
            root.set('viewBox', f"0 0 {width} {height}")
        
        # Write the modified SVG
        tree.write(output_path, encoding='utf-8', xml_declaration=True)
        return True
        
    except Exception as e:
        print(f"Error creating SVG {output_path}: {e}")
        return False

def create_png_from_template(template_path, output_path, width, height):
    """Create PNG file from SVG template with specified d2lensions."""
    try:
        if HAS_INKSCAPE:
            # Use Inkscape if available (best quality)
            cmd = [
                'inkscape',
                str(template_path),
                '--export-type=png',
                f'--export-filename={output_path}',
                f'--export-width={width}',
                f'--export-height={height}'
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode == 0:
                return True
            else:
                print(f"Inkscape error: {result.stderr}")
                return False
        else:
            # Fallback: Create a simple colored rectangle as placeholder
            # This is not ideal but works when no SVG converter is available
            print(f"Warning: Creating placeholder PNG for {output_path} (no SVG converter available)")
            
            # Create a simple placeholder image
            img = Image.new('RGBA', (width, height), (100, 150, 200, 255))  # Light blue
            draw = ImageDraw.Draw(img)
            
            # Add a simple border
            border_width = max(1, min(width, height) // 20)
            draw.rectangle([0, 0, width-1, height-1], outline=(50, 75, 100, 255), width=border_width)
            
            # Add an X pattern to indicate it's a placeholder
            draw.line([0, 0, width-1, height-1], fill=(50, 75, 100, 255), width=border_width)
            draw.line([0, height-1, width-1, 0], fill=(50, 75, 100, 255), width=border_width)
            
            img.save(output_path, 'PNG')
            return True
            
    except Exception as e:
        print(f"Error creating PNG {output_path}: {e}")
        return False

def scan_and_replace_icons(directory, template_path):
    """Recursively scan directory for SVG and PNG files and replace them."""
    directory_path = Path(directory)
    template_file = Path(template_path)
    
    if not directory_path.exists():
        print(f"Error: Directory '{directory}' does not exist.")
        return []
    
    if not template_file.exists():
        print(f"Error: Template file '{template_path}' does not exist.")
        return []
    
    icons = []
    processed = 0
    errors = 0
    skipped = 0
    
    print("Phase 1: Scanning and analyzing existing icons...")
    
    # First pass: Scan and collect information about existing files
    files_to_process = []
    for file_path in directory_path.rglob('*'):
        if file_path.is_file():
            extension = file_path.suffix.lower()
            
            if extension in ['.svg', '.png']:
                relative_path = file_path.relative_to(directory_path)
                
                # Skip the template file itself
                try:
                    if file_path.samefile(template_file):
                        print(f"Skipping template file: {relative_path}")
                        continue
                except (OSError, ValueError):
                    # Files might not exist or be comparable, continue with name check
                    if file_path.name == template_file.name:
                        print(f"Skipping template file: {relative_path}")
                        continue
                
                # Analyze current file to get its resolution
                if extension == '.svg':
                    width, height = get_svg_d2lensions(file_path)
                    format_type = 'SVG'
                elif extension == '.png':
                    width, height = get_png_d2lensions(file_path)
                    format_type = 'PNG'
                
                if width is not None and height is not None:
                    resolution = f"{width}x{height}"
                    files_to_process.append({
                        'path': file_path,
                        'relative_path': relative_path,
                        'width': width,
                        'height': height,
                        'resolution': resolution,
                        'format': format_type,
                        'extension': extension
                    })
                    print(f"Found: {relative_path} ({resolution}, {format_type})")
                else:
                    icons.append({
                        'filename': str(relative_path),
                        'resolution': "Unknown",
                        'format': format_type,
                        'status': "- Skipped (unknown resolution)"
                    })
                    skipped += 1
                    print(f"Skipped: {relative_path} (unknown resolution)")
    
    print(f"\nPhase 2: Replacing {len(files_to_process)} files with template...")
    
    # Second pass: Replace files with template-based versions
    for file_info in files_to_process:
        file_path = file_info['path']
        relative_path = file_info['relative_path']
        width = file_info['width']
        height = file_info['height']
        resolution = file_info['resolution']
        format_type = file_info['format']
        extension = file_info['extension']
        
        print(f"Processing: {relative_path} -> {resolution}")
        
        # Create backup
        backup_path = file_path.with_suffix(f'.backup{file_path.suffix}')
        try:
            file_path.rename(backup_path)
        except Exception as e:
            print(f"  Warning: Could not create backup for {file_path}: {e}")
            icons.append({
                'filename': str(relative_path),
                'resolution': resolution,
                'format': format_type,
                'status': "✗ Failed (backup error)"
            })
            errors += 1
            continue
        
        # Replace with template-based version at the discovered resolution
        success = False
        if extension == '.svg':
            success = create_svg_from_template(template_path, file_path, width, height)
        elif extension == '.png':
            success = create_png_from_template(template_path, file_path, width, height)
        
        if success:
            processed += 1
            status = "✓ Replaced"
            print(f"  ✓ Successfully replaced with {resolution} version")
            # Remove backup if successful
            try:
                backup_path.unlink()
            except:
                pass
        else:
            errors += 1
            status = "✗ Failed"
            print(f"  ✗ Failed to replace")
            # Restore backup if failed
            try:
                backup_path.rename(file_path)
            except:
                print(f"  ✗ Could not restore backup!")
        
        icons.append({
            'filename': str(relative_path),
            'resolution': resolution,
            'format': format_type,
            'status': status
        })
    
    print(f"\nProcessing complete:")
    print(f"✓ Successfully processed: {processed}")
    print(f"✗ Errors: {errors}")
    print(f"- Skipped (unknown resolution): {skipped}")
    
    return icons

def write_to_csv(icons, output_file):
    """Write results to CSV file."""
    try:
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['filename', 'resolution', 'format', 'status']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for icon in sorted(icons, key=lambda x: x['filename'].lower()):
                writer.writerow(icon)
        
        print(f"\nResults written to: {output_file}")
        return True
    except Exception as e:
        print(f"Error writing to CSV: {e}")
        return False

def print_results(icons):
    """Print results in a formatted table."""
    if not icons:
        print("No SVG or PNG files found.")
        return
    
    # Calculate column widths
    max_filename_len = max(len(icon['filename']) for icon in icons)
    max_resolution_len = max(len(icon['resolution']) for icon in icons)
    max_format_len = max(len(icon['format']) for icon in icons)
    max_status_len = max(len(icon['status']) for icon in icons)
    
    # Ensure minimum column widths
    filename_width = max(max_filename_len, len('Filename'))
    resolution_width = max(max_resolution_len, len('Resolution'))
    format_width = max(max_format_len, len('Format'))
    status_width = max(max_status_len, len('Status'))
    
    # Print header
    header = f"{'Filename':<{filename_width}} | {'Resolution':<{resolution_width}} | {'Format':<{format_width}} | {'Status':<{status_width}}"
    print(header)
    print('-' * len(header))
    
    # Print each icon
    for icon in sorted(icons, key=lambda x: x['filename'].lower()):
        print(f"{icon['filename']:<{filename_width}} | {icon['resolution']:<{resolution_width}} | {icon['format']:<{format_width}} | {icon['status']:<{status_width}}")
    
    print(f"\nTotal files found: {len(icons)}")

def process_single_file(file_path, template_path):
    """Process a single file instead of scanning directory."""
    file_path = Path(file_path)
    template_file = Path(template_path)
    
    if not file_path.exists():
        print(f"Error: File '{file_path}' does not exist.")
        return []
    
    if not template_file.exists():
        print(f"Error: Template file '{template_path}' does not exist.")
        return []
    
    extension = file_path.suffix.lower()
    if extension not in ['.svg', '.png']:
        print(f"Error: File '{file_path}' is not an SVG or PNG file.")
        return []
    
    # Check if it's the template file itself
    try:
        if file_path.samefile(template_file):
            print(f"Error: Cannot process the template file itself.")
            return []
    except (OSError, ValueError):
        if file_path.name == template_file.name:
            print(f"Error: Cannot process the template file itself.")
            return []
    
    print(f"Processing single file: {file_path}")
    
    # Analyze current file to get its resolution
    if extension == '.svg':
        width, height = get_svg_d2lensions(file_path)
        format_type = 'SVG'
    elif extension == '.png':
        width, height = get_png_d2lensions(file_path)
        format_type = 'PNG'
    
    if width is None or height is None:
        print(f"Error: Could not determine resolution of {file_path}")
        return [{
            'filename': str(file_path.name),
            'resolution': "Unknown",
            'format': format_type,
            'status': "- Skipped (unknown resolution)"
        }]
    
    resolution = f"{width}x{height}"
    print(f"Found resolution: {resolution}")
    
    # Create backup
    backup_path = file_path.with_suffix(f'.backup{file_path.suffix}')
    try:
        file_path.rename(backup_path)
        print(f"Created backup: {backup_path.name}")
    except Exception as e:
        print(f"Error: Could not create backup for {file_path}: {e}")
        return [{
            'filename': str(file_path.name),
            'resolution': resolution,
            'format': format_type,
            'status': "✗ Failed (backup error)"
        }]
    
    # Replace with template-based version at the discovered resolution
    print(f"Replacing with template at {resolution}...")
    success = False
    if extension == '.svg':
        success = create_svg_from_template(template_path, file_path, width, height)
    elif extension == '.png':
        success = create_png_from_template(template_path, file_path, width, height)
    
    if success:
        print(f"✓ Successfully replaced {file_path.name} with {resolution} version")
        status = "✓ Replaced"
        # Remove backup if successful
        try:
            backup_path.unlink()
            print("Backup removed (replacement successful)")
        except:
            print("Warning: Could not remove backup file")
    else:
        print(f"✗ Failed to replace {file_path.name}")
        status = "✗ Failed"
        # Restore backup if failed
        try:
            backup_path.rename(file_path)
            print("Original file restored from backup")
        except:
            print("✗ Critical error: Could not restore backup!")
    
    return [{
        'filename': str(file_path.name),
        'resolution': resolution,
        'format': format_type,
        'status': status
    }]

def main():
    """Main function."""
    if len(sys.argv) > 3:
        print("Usage:")
        print("  python icon_replacer.py [directory_path]          # Process directory")
        print("  python icon_replacer.py --file <file_path>        # Process single file")
        print("")
        print("Examples:")
        print("  python icon_replacer.py ./icons                   # Process icons directory") 
        print("  python icon_replacer.py                           # Process current directory")
        print("  python icon_replacer.py --file icon.svg           # Process single file")
        print("  python icon_replacer.py --file ./icons/test.png   # Process single file with path")
        print("")
        print("Requires 'input.svg' template file in the same directory as the script.")
        sys.exit(1)
    
    script_dir = Path(__file__).parent
    template_path = script_dir / "input.svg"
    
    # Check for single file mode
    if len(sys.argv) == 3 and sys.argv[1] == '--file':
        single_file = sys.argv[2]
        
        print("Icon Template Replacer - Single File Mode")
        print("=" * 50)
        print(f"Processing file: {os.path.abspath(single_file)}")
        print(f"Using template: {template_path}")
        
        if HAS_INKSCAPE:
            print("✓ Inkscape found - high quality PNG conversion available")
        else:
            print("⚠ Inkscape not found - will create placeholder PNGs")
            print("  For best results, install Inkscape: https://inkscape.org/")
        print()
        
        # Check if template exists
        if not template_path.exists():
            print(f"Error: Template file 'input.svg' not found in {script_dir}")
            print("Please ensure 'input.svg' exists in the same directory as this script.")
            sys.exit(1)
        
        print("Checking dependencies...")
        if not HAS_INKSCAPE:
            print("Note: Inkscape not found. PNG generation will use placeholders.")
            print("For high-quality PNG conversion, install Inkscape from: https://inkscape.org/")
        print()
        
        icons = process_single_file(single_file, template_path)
        
        # Generate output filename based on the processed file
        file_stem = Path(single_file).stem
        output_file = f"icon_replacement_log_{file_stem}.csv"
        
    else:
        # Directory mode (original behavior)
        directory = sys.argv[1] if len(sys.argv) == 2 else "."
        
        print("Icon Template Replacer - Directory Mode")
        print("=" * 50)
        print(f"Scanning directory: {os.path.abspath(directory)}")
        print(f"Using template: {template_path}")
        
        if HAS_INKSCAPE:
            print("✓ Inkscape found - high quality PNG conversion available")
        else:
            print("⚠ Inkscape not found - will create placeholder PNGs")
            print("  For best results, install Inkscape: https://inkscape.org/")
        
        print("Looking for SVG and PNG files recursively...\n")
        
        # Check if template exists
        if not template_path.exists():
            print(f"Error: Template file 'input.svg' not found in {script_dir}")
            print("Please ensure 'input.svg' exists in the same directory as this script.")
            sys.exit(1)
        
        print("Checking dependencies...")
        if not HAS_INKSCAPE:
            print("Note: Inkscape not found. PNG generation will use placeholders.")
            print("For high-quality PNG conversion, install Inkscape from: https://inkscape.org/")
        print()
        
        icons = scan_and_replace_icons(directory, template_path)
        
        # Generate output filename
        output_file = "icon_replacement_log.csv"
    
    print("Icon Template Replacer")
    print("=" * 50)
    print(f"Scanning directory: {os.path.abspath(directory)}")
    print(f"Using template: {template_path}")
    
    if HAS_INKSCAPE:
        print("✓ Inkscape found - high quality PNG conversion available")
    else:
        print("⚠ Inkscape not found - will create placeholder PNGs")
        print("  For best results, install Inkscape: https://inkscape.org/")
    
    print("Looking for SVG and PNG files recursively...\n")
    
    # Check if template exists
    if not template_path.exists():
        print(f"Error: Template file 'input.svg' not found in {script_dir}")
        print("Please ensure 'input.svg' exists in the same directory as this script.")
        sys.exit(1)
    
    # Check for required dependencies
    print("Checking dependencies...")
    if not HAS_INKSCAPE:
        print("Note: Inkscape not found. PNG generation will use placeholders.")
        print("For high-quality PNG conversion, install Inkscape from: https://inkscape.org/")
    print()
    
    icons = scan_and_replace_icons(directory, template_path)
    
    # Generate output filename
    output_file = "icon_replacement_log.csv"
    
    # Write to CSV and display results
    write_to_csv(icons, output_file)
    print_results(icons)

if __name__ == "__main__":
    main()