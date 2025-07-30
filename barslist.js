let resultBARSLIST = null
let resultNameBARSLIST = null
let inFileTypesBARSLIST = ["barslist"]
let outFileTypeBARSLIST = "json"
async function decompressFileFromBARSLIST () {
    let file = await importFile(inFileTypesBARSLIST)
    let fileBuf = new FileBuf(file.buf)
    resultBARSLIST = decompressFromBARSLIST(fileBuf)
    resultNameBARSLIST = file.name
}
async function downloadResultBARSLIST () {
    await exportFile(resultBARSLIST, resultNameBARSLIST, outFileTypeBARSLIST)
}
function decompressFromBARSLIST (fileBuf) {
    let numMode = null
    let header = fileBuf.buf(0x00, 0x10)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, "ARSL", "BARSLIST header does not start with 'ARSL'")
        let header_byteOrder = header.int(0x04, IntSize.U16, Endian.BIG)
            header_byteOrder = header_byteOrder.toString(16)
            if (header_byteOrder == "feff") numMode = Endian.BIG
            else if (header_byteOrder == "fffe") numMode = Endian.LITTLE
        let header_version = header.int(0x06, IntSize.U16, numMode)
            FileBuf.expectVal(header_version, 0x01, "BARSLIST header states unknown version")
        let header_nameStrOffset = header.int(0x08, IntSize.U32, numMode)
        let header_audioCount = header.int(0x0C, IntSize.U32, numMode)
    let audioOffsetsBuf = fileBuf.buf(0x10, header_audioCount * 0x04)
        let audioOffsets = new Array(header_audioCount)
        for (let i = 0; i < header_audioCount; i++) audioOffsets[i] = audioOffsetsBuf.int(i * 0x04, IntSize.U32, numMode)
        let offsets = [header_nameStrOffset, ...audioOffsets]
    let namesBuf = fileBuf.buf((header_audioCount * 0x04) + 0x10, fileBuf.data.byteLength - ((header_audioCount * 0x04) + 0x10))
        let namesArr = new Uint8Array(namesBuf.data)
        let names = new Array(header_audioCount + 1)
        for (let i = 0; i < header_audioCount + 1; i++) {
            let nullIndex = namesArr.indexOf(0x00, offsets[i])
            let strArr = namesArr.slice(offsets[i], nullIndex)
            let str = new TextDecoder().decode(strArr.buffer)
            names[i] = str
        }
        let nameStr = names.splice(0, 1)[0]
    let jsonObj = {
        name: nameStr,
        files: names,
    }
        let json = JSON.stringify(jsonObj, null, 4) + "\n"
        let jsonBuf = new TextEncoder().encode(json).buffer
    return jsonBuf
}
