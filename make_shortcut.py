import struct, subprocess
from pathlib import Path

BG   = (0x0f, 0x09, 0x07, 0xff)
CYAN = (0xf0, 0xc8, 0x00, 0xff)
GRN  = (0x76, 0xe6, 0x00, 0xff)
RED  = (0x55, 0x33, 0xff, 0xff)
DIM  = (0x40, 0x27, 0x1a, 0xff)
WHT  = (0xff, 0xff, 0xff, 0xff)

def make_grid():
    g = [BG] * 1024
    def px(x, y, c):
        if 0 <= x < 32 and 0 <= y < 32: g[y*32+x] = c
    def rect(x1,y1,x2,y2,c):
        [px(x,y,c) for y in range(y1,y2+1) for x in range(x1,x2+1)]
    def hline(y,x1,x2,c): [px(x,y,c) for x in range(x1,x2+1)]
    def vline(x,y1,y2,c): [px(x,y,c) for y in range(y1,y2+1)]

    # border
    hline(1,2,29,CYAN); hline(30,2,29,CYAN)
    vline(1,2,29,CYAN); vline(30,2,29,CYAN)
    for corner in [(2,1),(29,1),(2,30),(29,30)]: px(*corner, CYAN)

    # head
    rect(5,4,26,12,DIM)
    rect(6,5,25,11,(0x20,0x14,0x0a,0xff))
    # eyes
    rect(8,6,12,10,CYAN);  rect(8,6,12,10,CYAN)
    rect(19,6,23,10,CYAN)
    px(9,7,WHT); px(10,7,WHT); px(20,7,WHT); px(21,7,WHT)
    # mouth
    hline(11,8,23,CYAN)

    # body
    rect(4,14,27,27,DIM)
    # axes
    hline(26,5,26,CYAN); vline(5,15,26,CYAN)
    # candles
    for x,y1,y2,top,bot,col in [
        (9, 18,25, 19,24, GRN),
        (13,16,24, 17,23, RED),
        (17,15,22, 16,21, GRN),
        (21,18,24, 19,23, GRN),
        (25,14,21, 15,20, GRN),
    ]:
        vline(x,y1,y2,col); rect(x-1,top,x+1,bot,col)

    # antenna
    vline(15,1,3,CYAN); px(14,1,CYAN); px(16,1,CYAN); px(15,0,WHT)
    return g

def write_ico(path):
    g = make_grid()
    pixels = bytearray()
    for y in range(31,-1,-1):
        for x in range(32):
            b,gr,r,a = g[y*32+x]; pixels += bytes([b,gr,r,a])
    mask = bytearray(32*4)
    hdr  = struct.pack('<IiiHHIIiiII',40,32,64,1,32,0,0,0,0,0,0)
    img  = hdr + bytes(pixels) + bytes(mask)
    ico  = struct.pack('<HHH',0,1,1) + struct.pack('<BBBBHHII',32,32,0,0,1,32,len(img),22)
    Path(path).write_bytes(ico + img)
    print(f"Icon: {path}")

def make_shortcut(ico):
    bat     = str(Path(__file__).parent / "start.bat")
    desktop = subprocess.check_output(
        ['powershell','-NoProfile','-Command',
         '(New-Object -ComObject WScript.Shell).SpecialFolders("Desktop")'],
        text=True).strip()
    lnk = desktop + r"\The RoBot.lnk"
    ps  = f"""
$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut('{lnk}')
$s.TargetPath       = 'cmd.exe'
$s.Arguments        = '/c ""{bat}""'
$s.WorkingDirectory = '{str(Path(bat).parent)}'
$s.IconLocation     = '{ico},0'
$s.WindowStyle      = 1
$s.Description      = 'The RoBot Trading Station'
$s.Save()
"""
    subprocess.run(['powershell','-NoProfile','-Command', ps], check=True)
    print(f"Shortcut: {lnk}")

if __name__ == "__main__":
    ico = str(Path(__file__).parent / "robot.ico")
    write_ico(ico)
    make_shortcut(ico)
    print("Done.")
