#!/bin/bash

# Script to replace all references from D2L to D2L and d2l to d2l
# in both file contents and file/folder names

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in the correct directory
echo -e "${YELLOW}This script will replace all references of D2L->D2L and d2l->d2l${NC}"
echo -e "${YELLOW}Current directory: $(pwd)${NC}"
read -p "Are you sure you want to proceed? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Operation cancelled${NC}"
    exit 1
fi

# Create backup
echo -e "${GREEN}Creating backup...${NC}"
backup_dir="../backup_$(date +%Y%m%d_%H%M%S)"
cp -r . "$backup_dir" 2>/dev/null || {
    echo -e "${RED}Failed to create backup. Exiting.${NC}"
    exit 1
}
echo -e "${GREEN}Backup created at: $backup_dir${NC}"

# Function to replace content in files
replace_in_files() {
    echo -e "${GREEN}Replacing D2L/d2l references in file contents...${NC}"
    
    # Find all text files, excluding common binary and dependency directories
    find . -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        -not -path "*/.next/*" \
        -not -path "*/coverage/*" \
        -not -path "*.png" \
        -not -path "*.jpg" \
        -not -path "*.jpeg" \
        -not -path "*.gif" \
        -not -path "*.ico" \
        -not -path "*.svg" \
        -not -path "*.woff*" \
        -not -path "*.ttf" \
        -not -path "*.eot" \
        -not -path "*.zip" \
        -not -path "*.tar*" \
        -not -path "*.pdf" \
        -exec grep -l "D2L\|d2l" {} \; 2>/dev/null | while read -r file; do
        
        # Check if file is likely text/code
        if file "$file" | grep -qE "text|ASCII|UTF"; then
            echo "  Processing: $file"
            
            # Create temp file
            temp_file="${file}.tmp"
            
            # Replace D2L with D2L (case sensitive)
            # Then replace d2l with d2l (case sensitive)
            sed 's/D2L/D2L/g; s/d2l/d2l/g' "$file" > "$temp_file"
            
            # Check if sed was successful
            if [ $? -eq 0 ]; then
                mv "$temp_file" "$file"
            else
                echo -e "${RED}  Failed to process: $file${NC}"
                rm -f "$temp_file"
            fi
        fi
    done
    
    echo -e "${GREEN}Content replacement completed${NC}"
}

# Function to rename files and directories
rename_files_and_dirs() {
    echo -e "${GREEN}Renaming files and directories...${NC}"
    
    # First rename files (bottom-up to avoid path issues)
    find . -depth -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        | while read -r file; do
        
        filename=$(basename "$file")
        dirname=$(dirname "$file")
        
        # Check if filename contains D2L or d2l
        if echo "$filename" | grep -qE "D2L|d2l"; then
            # Replace D2L with D2L and d2l with d2l in filename
            new_filename=$(echo "$filename" | sed 's/D2L/D2L/g; s/d2l/d2l/g')
            
            if [ "$filename" != "$new_filename" ]; then
                echo "  Renaming file: $file -> $dirname/$new_filename"
                mv "$file" "$dirname/$new_filename"
            fi
        fi
    done
    
    # Then rename directories (bottom-up)
    find . -depth -type d \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        -not -path "." \
        | while read -r dir; do
        
        dirname=$(basename "$dir")
        parent=$(dirname "$dir")
        
        # Check if directory name contains D2L or d2l
        if echo "$dirname" | grep -qE "D2L|d2l"; then
            # Replace D2L with D2L and d2l with d2l in directory name
            new_dirname=$(echo "$dirname" | sed 's/D2L/D2L/g; s/d2l/d2l/g')
            
            if [ "$dirname" != "$new_dirname" ]; then
                echo "  Renaming directory: $dir -> $parent/$new_dirname"
                mv "$dir" "$parent/$new_dirname"
            fi
        fi
    done
    
    echo -e "${GREEN}File and directory renaming completed${NC}"
}

# Main execution
echo -e "${GREEN}Starting D2L to D2L conversion...${NC}"

# Step 1: Replace content in files
replace_in_files

# Step 2: Rename files and directories
rename_files_and_dirs

# Update package.json name if it exists
if [ -f "package.json" ]; then
    echo -e "${GREEN}Updating package.json...${NC}"
    # This ensures the package name is updated if it contains d2l
    sed -i.bak 's/"name":[[:space:]]*"[^"]*d2l[^"]*"/"name": "d2l"/g' package.json
    sed -i.bak 's/"name":[[:space:]]*"[^"]*D2L[^"]*"/"name": "D2L"/g' package.json
    rm -f package.json.bak
fi

echo -e "${GREEN}✅ Conversion complete!${NC}"
echo -e "${YELLOW}Recommendations:${NC}"
echo "1. Review the changes to ensure everything was converted correctly"
echo "2. Run 'npm install' or 'yarn install' to update dependencies"
echo "3. Update any external references, documentation, or CI/CD configurations"
echo "4. Test your application thoroughly"
echo -e "${YELLOW}Backup saved at: $backup_dir${NC}"