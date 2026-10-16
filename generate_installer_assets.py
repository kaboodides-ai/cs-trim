import struct, zlib, math, os

def decode_png(filename):
    with open(filename, 'rb') as f:
        data = f.read()
    pos = 8
    width = height = None
    idat = []
    while pos < len(data):
        length, chunk_type = struct.unpack('>I4s', data[pos:pos+8])
        chunk_data = data[pos+8:pos+8+length]
        pos += 12 + length
        if chunk_type == b'IHDR':
            width, height = struct.unpack('>II', chunk_data[:8])
        elif chunk_type == b'IDAT':
            idat.append(chunk_data)
    raw = zlib.decompress(b''.join(idat))
    bpp = 4
    stride = 1 + width * bpp
    pixels = []
    prev_row = bytearray(width * bpp)
    for y in range(height):
        filter_type = raw[y * stride]
        row_data = bytearray(raw[y * stride + 1 : (y + 1) * stride])
        if filter_type == 1:
            for x in range(bpp, width * bpp):
                row_data[x] = (row_data[x] + row_data[x - bpp]) & 0xFF
        elif filter_type == 2:
            for x in range(width * bpp):
                row_data[x] = (row_data[x] + prev_row[x]) & 0xFF
        elif filter_type == 3:
            for x in range(width * bpp):
                left = row_data[x - bpp] if x >= bpp else 0
                row_data[x] = (row_data[x] + ((left + prev_row[x]) >> 1)) & 0xFF
        elif filter_type == 4:
            for x in range(width * bpp):
                a = row_data[x - bpp] if x >= bpp else 0
                b = prev_row[x]
                c = prev_row[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa = abs(p - a)
                pb = abs(p - b)
                pc = abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                row_data[x] = (row_data[x] + pr) & 0xFF
        prev_row = row_data
        pixels.append(row_data)
    return width, height, pixels

def pad_to_square(pixels, w, h):
    target = max(w, h)
    pad_x = (target - w) // 2
    pad_y = (target - h) // 2
    out = []
    blank_row = bytearray(target * 4)
    for _ in range(pad_y):
        out.append(bytearray(blank_row))
    for y in range(h):
        row = bytearray(target * 4)
        row[pad_x*4 : (pad_x+w)*4] = pixels[y]
        out.append(row)
    while len(out) < target:
        out.append(bytearray(blank_row))
    return target, out

def resize_rgba(src_pixels, src_w, src_h, dst_w, dst_h):
    dst = []
    scale_x = (src_w - 1) / max(1, dst_w - 1) if dst_w > 1 else 0
    scale_y = (src_h - 1) / max(1, dst_h - 1) if dst_h > 1 else 0
    for dy in range(dst_h):
        sy = dy * scale_y
        y0 = int(sy)
        y1 = min(y0 + 1, src_h - 1)
        fy = sy - y0
        row = bytearray(dst_w * 4)
        for dx in range(dst_w):
            sx = dx * scale_x
            x0 = int(sx)
            x1 = min(x0 + 1, src_w - 1)
            fx = sx - x0
            
            p00 = src_pixels[y0][x0*4:(x0+1)*4]
            p10 = src_pixels[y0][x1*4:(x1+1)*4]
            p01 = src_pixels[y1][x0*4:(x0+1)*4]
            p11 = src_pixels[y1][x1*4:(x1+1)*4]
            
            for c in range(4):
                top = p00[c] * (1 - fx) + p10[c] * fx
                bot = p01[c] * (1 - fx) + p11[c] * fx
                val = int(round(top * (1 - fy) + bot * fy))
                row[dx*4 + c] = min(255, max(0, val))
        dst.append(row)
    return dst

def make_png_chunk(chunk_type, data):
    c = chunk_type + data
    crc = zlib.crc32(c) & 0xffffffff
    return struct.pack('>I', len(data)) + c + struct.pack('>I', crc)

def encode_png(rgba_rows, width, height):
    raw = bytearray()
    for y in range(height):
        raw.append(0) # filter None
        raw.extend(rgba_rows[y])
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    return b'\x89PNG\r\n\x1a\n' + make_png_chunk(b'IHDR', ihdr) + make_png_chunk(b'IDAT', idat) + make_png_chunk(b'IEND', b'')

def make_dib_entry(rgba_rows, size):
    color_data = bytearray()
    and_mask_stride = ((size + 31) // 32) * 4
    and_mask = bytearray()
    
    for y in reversed(range(size)):
        row = rgba_rows[y]
        mask_row = bytearray(and_mask_stride)
        for x in range(size):
            r = row[x*4]
            g = row[x*4 + 1]
            b = row[x*4 + 2]
            a = row[x*4 + 3]
            color_data.extend([b, g, r, a])
            if a == 0:
                mask_row[x // 8] |= (1 << (7 - (x % 8)))
        and_mask.extend(mask_row)
        
    color_size = size * size * 4
    mask_size = and_mask_stride * size
    bih = struct.pack('<IIIHHIIIIII', 40, size, size * 2, 1, 32, 0, color_size + mask_size, 0, 0, 0, 0)
    return bih + color_data + and_mask

def write_bmp24(filename, width, height, rgb_rows):
    row_stride = ((width * 3 + 3) // 4) * 4
    image_size = row_stride * height
    file_size = 54 + image_size
    
    header = struct.pack('<2sIHHI', b'BM', file_size, 0, 0, 54)
    info = struct.pack('<IIIHHIIIIII', 40, width, height, 1, 24, 0, image_size, 2835, 2835, 0, 0)
    
    pad = b'\x00' * (row_stride - width * 3)
    data = bytearray()
    for y in reversed(range(height)):
        row = rgb_rows[y]
        for x in range(width):
            r = row[x*3]
            g = row[x*3 + 1]
            b = row[x*3 + 2]
            data.extend([b, g, r])
        data.extend(pad)
        
    with open(filename, 'wb') as f:
        f.write(header)
        f.write(info)
        f.write(data)

def generate_assets():
    base = os.path.dirname(os.path.abspath(__file__))
    logo_path = os.path.join(base, "img", "logo.png")
    orig_w, orig_h, orig_pixels = decode_png(logo_path)
    sq_size, sq_pixels = pad_to_square(orig_pixels, orig_w, orig_h)
    
    # -------------------------------------------------------------
    # 1. Generate multi-resolution img/logo.ico
    # Sizes: 16, 24, 32, 48, 64, 128 (DIB) and 256 (PNG)
    # -------------------------------------------------------------
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    entries = []
    data_blobs = []
    
    for s in ico_sizes:
        resized = resize_rgba(sq_pixels, sq_size, sq_size, s, s)
        if s == 256:
            blob = encode_png(resized, 256, 256)
            width_byte = 0
            height_byte = 0
        else:
            blob = make_dib_entry(resized, s)
            width_byte = s
            height_byte = s
        entries.append((width_byte, height_byte, len(blob)))
        data_blobs.append(blob)
        
    num_icons = len(ico_sizes)
    header = struct.pack('<HHH', 0, 1, num_icons)
    cur_offset = 6 + num_icons * 16
    dir_entries = bytearray()
    
    for (wb, hb, blen) in entries:
        dir_entries.extend(struct.pack('<BBBBHHII', wb, hb, 0, 0, 1, 32, blen, cur_offset))
        cur_offset += blen
        
    ico_bytes = header + dir_entries + b''.join(data_blobs)
    ico_out = os.path.join(base, "img", "logo.ico")
    with open(ico_out, 'wb') as f:
        f.write(ico_bytes)
    print(f"Generated {ico_out} ({len(ico_bytes)} bytes, {num_icons} sizes)")
    
    # -------------------------------------------------------------
    # 2. Generate img/installer_welcome.bmp (164 x 314)
    # Modern dark gradient with glowing logo in center
    # -------------------------------------------------------------
    w_width, w_height = 164, 314
    welcome_rows = []
    
    # Logo scaled to 110 x 126 (maintaining 350:400)
    logo_target_w = 112
    logo_target_h = int(round(logo_target_w * (orig_h / orig_w))) # ~128
    logo_resized = resize_rgba(orig_pixels, orig_w, orig_h, logo_target_w, logo_target_h)
    
    logo_start_x = (w_width - logo_target_w) // 2
    logo_start_y = 52
    
    for y in range(w_height):
        # Gradient from top (15, 18, 28) to bottom (21, 26, 40)
        t = y / (w_height - 1)
        bg_r = int(14 * (1 - t) + 22 * t)
        bg_g = int(17 * (1 - t) + 27 * t)
        bg_b = int(28 * (1 - t) + 42 * t)
        
        row = bytearray(w_width * 3)
        for x in range(w_width):
            # Radial blue glow behind logo
            dx = x - (w_width // 2)
            dy = y - (logo_start_y + logo_target_h // 2)
            dist = math.sqrt(dx * dx + dy * dy)
            glow_radius = 80.0
            if dist < glow_radius:
                glow_factor = (1.0 - (dist / glow_radius)) ** 1.8 * 0.45
                r = int(bg_r * (1 - glow_factor) + 37 * glow_factor)
                g = int(bg_g * (1 - glow_factor) + 99 * glow_factor)
                b = int(bg_b * (1 - glow_factor) + 235 * glow_factor)
            else:
                r, g, b = bg_r, bg_g, bg_b
                
            # Check if inside logo bounds
            lx = x - logo_start_x
            ly = y - logo_start_y
            if 0 <= lx < logo_target_w and 0 <= ly < logo_target_h:
                lp = logo_resized[ly][lx*4 : (lx+1)*4]
                la = lp[3] / 255.0
                r = int(r * (1 - la) + lp[0] * la)
                g = int(g * (1 - la) + lp[1] * la)
                b = int(b * (1 - la) + lp[2] * la)
                
            # Decorative subtle accent line at y = 210
            if y == 212 and 24 <= x < w_width - 24:
                line_alpha = math.sin((x - 24) / (w_width - 48) * math.pi) * 0.65
                r = int(r * (1 - line_alpha) + 56 * line_alpha)
                g = int(g * (1 - line_alpha) + 189 * line_alpha)
                b = int(b * (1 - line_alpha) + 248 * line_alpha)

            # Elegant subtle border at x = 0 (left edge touching white dialog in RTL)
            if x == 0:
                r, g, b = 220, 226, 235
                
            row[x*3] = min(255, max(0, r))
            row[x*3 + 1] = min(255, max(0, g))
            row[x*3 + 2] = min(255, max(0, b))
        welcome_rows.append(row)
        
    welcome_out = os.path.join(base, "img", "installer_welcome.bmp")
    write_bmp24(welcome_out, w_width, w_height, welcome_rows)
    print(f"Generated {welcome_out} ({w_width}x{w_height})")
    
    # -------------------------------------------------------------
    # 3. Generate img/installer_header.bmp (150 x 57)
    # White background with crisp CS Trim logo on the left (RTL friendly)
    # -------------------------------------------------------------
    h_width, h_height = 150, 57
    h_logo_h = 44
    h_logo_w = int(round(h_logo_h * (orig_w / orig_h))) # ~38
    h_logo_resized = resize_rgba(orig_pixels, orig_w, orig_h, h_logo_w, h_logo_h)
    
    # Align to left side (x=12) so in RTL it sits gracefully on the left while Hebrew title is on right
    h_start_x = 12
    h_start_y = (h_height - h_logo_h) // 2
    
    header_rows = []
    for y in range(h_height):
        row = bytearray(h_width * 3)
        for x in range(h_width):
            # Pure white background to blend seamlessly with NSIS header
            r, g, b = 255, 255, 255
            
            lx = x - h_start_x
            ly = y - h_start_y
            if 0 <= lx < h_logo_w and 0 <= ly < h_logo_h:
                lp = h_logo_resized[ly][lx*4 : (lx+1)*4]
                la = lp[3] / 255.0
                r = int(r * (1 - la) + lp[0] * la)
                g = int(g * (1 - la) + lp[1] * la)
                b = int(b * (1 - la) + lp[2] * la)
                
            row[x*3] = min(255, max(0, r))
            row[x*3 + 1] = min(255, max(0, g))
            row[x*3 + 2] = min(255, max(0, b))
        header_rows.append(row)
        
    header_out = os.path.join(base, "img", "installer_header.bmp")
    write_bmp24(header_out, h_width, h_height, header_rows)
    print(f"Generated {header_out} ({h_width}x{h_height})")

if __name__ == "__main__":
    generate_assets()

