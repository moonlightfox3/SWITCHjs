let resultYaz0 = null
let resultNameYaz0 = null
let outFileTypeYaz0 = "bin"
async function decompressFileFromYaz0 () {
    let file = await importFile(["szs", "arc"])
    resultYaz0 = decompressFromYaz0(file.buf)
    resultNameYaz0 = file.name
}
async function downloadResult () {
    let outFileType = getFileType(resultYaz0).ext
    await exportFile(resultYaz0, resultNameYaz0, outFileType)
}
function decompressFromYaz0 (data) {
    let header = getBuf(data, 0, 16)
        let header_name = getStr(header, 0, 4)
            expectVal(header_name, "Yaz0", "Invalid file", "Yaz0 header does not start with 'Yaz0'")
        let header_outSize = getNum(header, 4, 4, "BE")
        let header_unused = getNum(header, 8, 8, "BE")
    let src = getBuf(data, 16, data.byteLength - 16)
        let out = new Uint8Array(header_outSize)
        let srcPos = outPos = 0
        while (outPos < header_outSize) {
            let code = getByte(src, srcPos)
                srcPos++
            for (let i = 0; i < 8; i++) {
                let bit = byteGetBit(code, i)
                if (bit == 1) {
                    let copy = getByte(src, srcPos)
                        srcPos++
                    out[outPos] = copy
                        outPos++
                } else if (bit == 0) {
                    let byte1 = getByte(src, srcPos)
                        srcPos++
                        let a = byteGetNibble(byte1, 0)
                        let b = byteGetNibble(byte1, 1)
                    let byte2 = getByte(src, srcPos)
                        srcPos++
                    
                    let count = a
                        if (count == 0) {
                            let byte3 = getByte(src, srcPos)
                                srcPos++
                            count = byte3 + 0b00010010
                        } else count += 2
                    let moveDist = ((b << 8) | byte2) + 1

                    let copyPos = outPos - moveDist
                    for (let i = 0; i < count; i++) {
                        let copy = getByte(out, copyPos)
                            copyPos++
                        out[outPos] = copy
                            outPos++
                    }
                }
            }
        }
    return out.buffer
}
