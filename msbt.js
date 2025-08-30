let resultMSBT = null
let resultNameMSBT = null
let inFileTypesMSBT = ["msbt"]
let outFileTypeMSBT = "json"
async function decompressFileFromMSBT () {
    let file = await importFile(inFileTypesMSBT)
    let fileBuf = new FileBuf(file.buf)
    resultMSBT = decompressFromMSBT(fileBuf)
    resultNameMSBT = file.name
}
async function downloadResultMSBT () {
    await exportFile(resultMSBT, resultNameMSBT, outFileTypeMSBT)
}
function decompressFromMSBT (fileBuf) {
    let numMode = null
    let header = fileBuf.buf(0x00, 0x20)
        let header_name = header.str(0x00, 0x08)
            FileBuf.expectVal(header_name, "MsgStdBn", "MSBT header does not start with 'MsgStdBn'")
        let header_byteOrder = header.int(0x08, IntSize.U16, Endian.BIG)
            header_byteOrder = header_byteOrder.toString(16)
            if (header_byteOrder == "feff") numMode = Endian.BIG
            else if (header_byteOrder == "fffe") numMode = Endian.LITTLE
        let header_padding1 = header.int(0x0A, IntSize.U16, numMode)
        let header_stringEncoding = header.int(0x0C, IntSize.U8, numMode)
            let header_stringEncodingName = null
            let header_stringEncodingSize = null
            if (header_stringEncoding == 0x00) FileBuf.expectVal(0, 1, "Not implemented (MSBT header states a currently unsupported encoding)") //header_stringEncodingName = "utf-8", header_stringEncodingSize = 1
            else if (header_stringEncoding == 0x01) header_stringEncodingName = "utf-16", header_stringEncodingSize = 2
            else if (header_stringEncoding == 0x02) FileBuf.expectVal(0, 1, "Not implemented (MSBT header states an unsupported encoding)") //header_stringEncodingName = "utf-32", header_stringEncodingSize = 4
            else FileBuf.expectVal(0, 1, "MSBT header states invalid encoding")
        let header_version = header.int(0x0D, IntSize.U8, numMode)
            FileBuf.expectVal(header_version, 0x03, "Not implemented (MSBT header states an unsupported version)")
        let header_blockCount = header.int(0x0E, IntSize.U16, numMode)
        let header_padding2 = header.int(0x10, IntSize.U16, numMode)
        let header_fileSize = header.int(0x12, IntSize.U32, numMode)
            FileBuf.expectVal(header_fileSize, fileBuf.data.byteLength, "MSBT header states invalid file size")
        let header_padding3 = header.int(0x16, 10, numMode)
    let src = fileBuf.buf(0x20, fileBuf.data.byteLength - 0x20)
        let labels = null
        let messages = null
        let srcBlockPointer = 0x00
        for (let i = 0; i < header_blockCount; i++) {
            let id = src.str(srcBlockPointer, 0x04)
            let size = src.int(srcBlockPointer + 0x04, IntSize.U32, numMode)
            let blockHeaderPadding = src.int(srcBlockPointer + 0x08, IntSize.U64, numMode)
            srcBlockPointer += 0x10

            let block = src.buf(srcBlockPointer, size)
                if (id == "LBL1") { // labels
                    FileBuf.expectVal(labels, null, "Duplicate LBL1 block")
                    labels = []
                    
                    let labelGroupCount = block.int(0x00, IntSize.U32, numMode)
                    let labelGroupsData = new Array(labelGroupCount)
                    let labelGroupsPointer = 0x04
                    for (let j = 0; j < labelGroupCount; j++) {
                        let count = block.int(labelGroupsPointer, IntSize.U32, numMode)
                        let offset = block.int(labelGroupsPointer + 0x04, IntSize.U32, numMode)
                        labelGroupsData[j] = {offset, count}
                        labelGroupsPointer += 0x08
                    }

                    for (let j = 0; j < labelGroupCount; j++) {
                        let offset = labelGroupsData[j].offset
                        for (let k = 0; k < labelGroupsData[j].count; k++) {
                            let stringLength = block.int(offset, IntSize.U8, numMode)
                            let label = block.str(offset + 0x01, stringLength)
                            let msgIndex = block.int(offset + 0x01 + stringLength, IntSize.U32, numMode)
                            labels.push({label, msgIndex})
                            offset = offset + stringLength + 0x05
                        }
                    }
                } else if (id == "TXT2") { // text
                    FileBuf.expectVal(messages, null, "Duplicate TXT2 block")
                    messages = []

                    let messageCount = block.int(0x00, IntSize.U32, numMode)
                    let offsets = new Array(messageCount)
                    for (let j = 0; j < messageCount; j++) offsets[j] = block.int((j * 0x04) + 0x04, IntSize.U32, numMode)
                    for (let j = 0; j < messageCount; j++) {
                        let strSize = j >= messageCount - 1 ? size - offsets[j] : offsets[j + 1] - offsets[j]
                        let strArr = [...block.arr(offsets[j], strSize)]
                        let strChars = []
                        for (let k = 0; k < strArr.length; k += header_stringEncodingSize) {
                            let char = strArr.slice(k, k + header_stringEncodingSize)
                            if (numMode == Endian.LITTLE) char.reverse()
                            strChars.push(char)
                        }
                        let strOut = []
                        let strOutPart = ""
                        let strDecoder = new TextDecoder(header_stringEncodingName + "be")
                        for (let k = 0; k < strChars.length; k++) {
                            if (k == strChars.length - 1) {
                                if (strChars[k][0] != 0x00 || strChars[k][1] != 0x00) FileBuf.expectVal(0, 1, "Message is not null-terminated")
                            } else if (strChars[k][0] == 0x00 && (strChars[k][1] == 0x0E || strChars[k][1] == 0x0F)) {
                                if (strOutPart.length > 0) strOut.push(strOutPart), strOutPart = ""

                                let group = (strChars[k + 1][0] << 8) + strChars[k + 1][1]
                                let type = (strChars[k + 2][0] << 8) + strChars[k + 2][1]
                                if (strChars[k][1] == 0x0F) FileBuf.expectVal(0, 1, "Not implemented (Unsupported tag type 0x000F)")
                                
                                let dataSize = (strChars[k + 3][0] << 8) + strChars[k + 3][1]
                                let numChars = dataSize / header_stringEncodingSize
                                if (numChars != Math.floor(numChars)) FileBuf.expectVal(0, 1, "Not implemented (Unsupported tag length)")
                                let data = [].concat(...strChars.slice(k + 4, k + 4 + numChars))
                                strOut.push({group, type, data})
                                k += numChars + 0x03
                            } else strOutPart += strDecoder.decode(new Uint8Array(strChars[k]).buffer)
                        }
                        if (strOutPart.length > 0) strOut.push(strOutPart), strOutPart = ""
                        messages[j] = strOut
                    }
                } else if (id == "ATR1") {
                    let attributeCount = block.int(0x00, IntSize.U32, numMode)
                    let singleAttributeSize = block.int(0x04, IntSize.U32, numMode)
                        FileBuf.expectVal(singleAttributeSize, 0, "Not implemented (Attributes block data)")
                } else FileBuf.expectVal(0, 1, "Invalid or unknown block ID")
            srcBlockPointer = Math.ceil((srcBlockPointer + size) / 16) * 16
        }
        FileBuf.expectVal(srcBlockPointer + 0x20, fileBuf.data.byteLength, "Invalid file layout")
        if (labels == null) FileBuf.expectVal(0, 1, "Missing required block LBL1")
        if (messages == null) FileBuf.expectVal(0, 1, "Missing required block TXT2")
    let out = []
    for (let i = 0; i < messages.length; i++) out.push({label: labels.find(val => val.msgIndex == i).label, message: messages[i]})
        let json = JSON.stringify(out, null, 4) + "\n"
        let jsonBuf = new TextEncoder().encode(json).buffer
    return jsonBuf
}
