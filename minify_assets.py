#!/usr/bin/env python
"""
Asset Minification Script
Minifies CSS and JavaScript files for production use.
"""

import os
import re


def minify_css(css_content):
    """
    Minify CSS by removing comments, whitespace, and optimizing rules.
    """
    # Remove comments
    css_content = re.sub(r'/\*[\s\S]*?\*/', '', css_content)
    
    # Remove newlines and extra whitespace
    css_content = re.sub(r'\s+', ' ', css_content)
    
    # Remove spaces around special characters
    css_content = re.sub(r'\s*([{}:;,>+~])\s*', r'\1', css_content)
    
    # Remove spaces around !important
    css_content = re.sub(r'\s*!\s*important', '!important', css_content)
    
    # Remove last semicolon before closing brace
    css_content = re.sub(r';}', '}', css_content)
    
    # Remove spaces in calc()
    css_content = re.sub(r'calc\s*\(\s*', 'calc(', css_content)
    
    # Optimize zero values
    css_content = re.sub(r':0px', ':0', css_content)
    css_content = re.sub(r':0rem', ':0', css_content)
    css_content = re.sub(r':0em', ':0', css_content)
    css_content = re.sub(r' 0px', ' 0', css_content)
    
    # Remove leading zeros in decimal
    css_content = re.sub(r':0\.', ':.', css_content)
    css_content = re.sub(r' 0\.', ' .', css_content)
    
    return css_content.strip()


def minify_js(js_content):
    """
    Minify JavaScript by removing comments and unnecessary whitespace.
    More conservative approach to avoid breaking code.
    """
    # Remove single-line comments (but not URLs with //)
    js_content = re.sub(r'(?<!:)//(?![\'"]).*?(?=\n|$)', '', js_content)
    
    # Remove multi-line comments
    js_content = re.sub(r'/\*[\s\S]*?\*/', '', js_content)
    
    # Remove leading/trailing whitespace from each line
    lines = js_content.split('\n')
    lines = [line.strip() for line in lines]
    
    # Join lines, adding semicolons where necessary
    result = []
    for line in lines:
        if line:
            result.append(line)
    
    js_content = '\n'.join(result)
    
    # Remove blank lines
    js_content = re.sub(r'\n+', '\n', js_content)
    
    # Remove spaces around operators (careful approach)
    js_content = re.sub(r'\s*{\s*', '{', js_content)
    js_content = re.sub(r'\s*}\s*', '}', js_content)
    js_content = re.sub(r'\s*;\s*', ';', js_content)
    js_content = re.sub(r'\s*,\s*', ',', js_content)
    
    # Remove newlines after certain characters
    js_content = re.sub(r'{\n', '{', js_content)
    js_content = re.sub(r';\n', ';', js_content)
    js_content = re.sub(r',\n', ',', js_content)
    
    # Fix function declarations
    js_content = re.sub(r'\)\s*{', '){', js_content)
    
    return js_content.strip()


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    css_dir = os.path.join(base_dir, 'static', 'css', 'manage_admin')
    js_dir = os.path.join(base_dir, 'static', 'js', 'manage_admin')
    
    # Minify CSS
    css_file = os.path.join(css_dir, 'styles.css')
    css_min_file = os.path.join(css_dir, 'styles.min.css')
    
    if os.path.exists(css_file):
        with open(css_file, 'r', encoding='utf-8') as f:
            css_content = f.read()
        
        original_size = len(css_content)
        minified_css = minify_css(css_content)
        minified_size = len(minified_css)
        
        with open(css_min_file, 'w', encoding='utf-8') as f:
            f.write(minified_css)
        
        reduction = ((original_size - minified_size) / original_size) * 100
        print(f"✅ CSS: {original_size:,} -> {minified_size:,} bytes ({reduction:.1f}% reduction)")
        print(f"   Saved to: {css_min_file}")
    else:
        print(f"❌ CSS file not found: {css_file}")
    
    # Minify JavaScript
    js_file = os.path.join(js_dir, 'scripts.js')
    js_min_file = os.path.join(js_dir, 'scripts.min.js')
    
    if os.path.exists(js_file):
        with open(js_file, 'r', encoding='utf-8') as f:
            js_content = f.read()
        
        original_size = len(js_content)
        minified_js = minify_js(js_content)
        minified_size = len(minified_js)
        
        with open(js_min_file, 'w', encoding='utf-8') as f:
            f.write(minified_js)
        
        reduction = ((original_size - minified_size) / original_size) * 100
        print(f"✅ JS:  {original_size:,} -> {minified_size:,} bytes ({reduction:.1f}% reduction)")
        print(f"   Saved to: {js_min_file}")
    else:
        print(f"❌ JS file not found: {js_file}")


if __name__ == '__main__':
    main()
