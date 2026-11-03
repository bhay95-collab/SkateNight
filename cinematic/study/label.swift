import AppKit
let text = CommandLine.arguments[1]
let output = CommandLine.arguments[2]
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 480, pixelsHigh: 24,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSColor(calibratedWhite: 0, alpha: 0.8).setFill()
NSRect(x: 0, y: 0, width: 480, height: 24).fill()
(text as NSString).draw(at: NSPoint(x: 8, y: 5), withAttributes: [
    .font: NSFont.monospacedSystemFont(ofSize: 10, weight: .regular),
    .foregroundColor: NSColor.white
])
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
