import AppKit

guard CommandLine.arguments.count == 3 else {
  fatalError("Usage: swift scripts/render-telegram-banner.swift <input.png> <output.png>")
}

let inputPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]

guard let source = NSImage(contentsOfFile: inputPath) else {
  fatalError("Unable to read input image: \(inputPath)")
}

let size = source.size
let output = NSImage(size: size)

output.lockFocus()
source.draw(in: NSRect(origin: .zero, size: size))

let panel = NSRect(
  x: size.width * 0.50,
  y: size.height * 0.03,
  width: size.width * 0.47,
  height: size.height * 0.33
)
NSColor.black.withAlphaComponent(0.62).setFill()
panel.fill()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
paragraph.lineSpacing = size.height * 0.015

let font =
  NSFont(name: "Arial Black", size: size.width * 0.06)
  ?? NSFont.boldSystemFont(ofSize: size.width * 0.062)

let text = "MANTLE\nSENTINEL" as NSString
let attributes: [NSAttributedString.Key: Any] = [
  .font: font,
  .foregroundColor: NSColor.white,
  .paragraphStyle: paragraph,
  .kern: size.width * 0.002,
]

let textRect = panel.insetBy(dx: size.width * 0.024, dy: size.height * 0.05)
text.draw(in: textRect, withAttributes: attributes)
output.unlockFocus()

guard
  let tiff = output.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let png = bitmap.representation(using: .png, properties: [:])
else {
  fatalError("Unable to encode output PNG")
}

try png.write(to: URL(fileURLWithPath: outputPath))
