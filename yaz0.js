let resultYaz0 = null
let resultNameYaz0 = null
let inFileTypesYaz0 = ["szs", "arc"]
let outFileTypeYaz0 = "bin"
async function decompressFileFromYaz0 () {
    let file = await importFile(inFileTypesYaz0)
    let fileBuf = new FileBuf(file.buf)
    resultYaz0 = decompressFromYaz0(fileBuf)
    resultNameYaz0 = file.name
}
async function downloadResultYaz0 () {
    await exportFile(resultYaz0, resultNameYaz0, outFileTypeYaz0)
}
function decompressFromYaz0 (fileBuf) {
    let header = fileBuf.buf(0x00, 0x10)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, "Yaz0", "Yaz0 header does not start with 'Yaz0'")
        let header_outSize = header.int(0x04, IntSize.U32, {endian: Endian.BIG})
        let header_unused = header.int(0x08, IntSize.U16, {endian: Endian.BIG})
    let src = fileBuf.buf(0x10, fileBuf.data.byteLength - 0x10)
        let out = new Uint8Array(header_outSize)
        let srcPos = outPos = 0
        while (outPos < header_outSize) {
            let code = src.byte(srcPos)
                srcPos++
            for (let i = 0; i < 8; i++) {
                let bit = FileBuf.bit_byte(code, {offset: i})
                if (bit == 1) {
                    let copy = src.byte(srcPos)
                        srcPos++
                    out[outPos] = copy
                        outPos++
                } else if (bit == 0) {
                    let byte1 = src.byte(srcPos)
                        srcPos++
                        let a = FileBuf.nibble_byte(byte1, {offset: 0})
                        let b = FileBuf.nibble_byte(byte1, {offset: 1})
                    let byte2 = src.byte(srcPos)
                        srcPos++
                    
                    let count = a
                        if (count == 0) {
                            let byte3 = src.byte(srcPos)
                                srcPos++
                            count = byte3 + 0b00010010
                        } else count += 2
                    let moveDist = ((b << 8) | byte2) + 1

                    let copyPos = outPos - moveDist
                    for (let i = 0; i < count; i++) {
                        let copy = out[copyPos]
                            copyPos++
                        out[outPos] = copy
                            outPos++
                    }
                }
            }
        }
    return out.buffer
}
