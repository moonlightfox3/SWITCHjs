// Some synchronous functions.

/* ***** DECOMPRESSION ***** */
function gzipDecompress (arrBuf) { // GZIP spec: https://datatracker.ietf.org/doc/html/rfc1952
    let members = []
    let buf = new Uint8Array(arrBuf)
    let pointer = 0
    while (true) {
        if (pointer >= buf.byteLength) break

        // Parse member header
        if (buf[pointer] != 0x1F || buf[pointer + 1] != 0x8B) throw new Error("[GZIP] Invalid data (Member starts with invalid bytes)"); pointer += 2
        let compressionMethod = buf[pointer]; pointer++
        if (compressionMethod >= 0 && compressionMethod <= 7) throw new Error("[GZIP] Invalid data (Member compression method is invalid)") // reserved
        if (compressionMethod != 8) throw new Error("[GZIP] Not implemented (Unknown member compression method)") // DEFLATE
        let flagBits = buf[pointer].toString(2).padStart(8, "0").split("").map(val => val != "0").reverse(); pointer++ // FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT, reserved, reserved, reserved
        if (flagBits[5] != 0 || flagBits[6] != 0 || flagBits[7] != 0) throw new Error("[GZIP] Invalid data (Member flags contain invalid data)")
        let modificationTime = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4 // Unix
        if (modificationTime == 0) modificationTime = null
        else modificationTime = new Date(modificationTime * 1000)
        let extraFlagBits = buf[pointer].toString(2).padStart(8, "0").split("").map(val => +val).reverse(); pointer++ // ?, ?, max compression, ?, min compression, ?, ?, ?, ?
        let os = buf[pointer]; pointer++ // enum
        if (os == 255) os = null
        else {
            os = ["FAT filesystem", "Amiga", "VMS/OpenVMS", "Unix", "VM/CMS", "Atari TOS", "HPFS filesystem", "Mac", "Z-System", "CP/M", "TOPS-20", "NTFS filesystem", "QDOS", "Acorn RISCOS"][os]
            if (os == undefined) throw new Error("[GZIP] Not implemented (Member OS information is unknown or invalid)")
        }

        let isText = flagBits[0] // FTEXT
        let extraData = null
        if (flagBits[2]) { // FEXTRA
            extraData = {}
            let extraDataLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
            let extraDataBuf = buf.slice(pointer, pointer + extraDataLength); pointer += extraDataLength
            let extraDataPointer = 0
            while (true) {
                if (extraDataPointer >= extraDataBuf.byteLength) break

                let id1 = extraDataBuf[extraDataPointer]; extraDataPointer++
                let id2 = extraDataBuf[extraDataPointer]; extraDataPointer++
                if (id2 == 0) throw new Error("[GZIP] Invalid data (Member extra data contains invalid data)")
                let type = null
                if (id1 == 0x41 && id2 == 0x70) type = "ApolloFileTypeInfo"
                if (type == null) throw new Error("[GZIP] Not implemented (Member extra data contains unknown data)")
                
                let length = (extraDataBuf[extraDataPointer + 1] << 8) + extraDataBuf[extraDataPointer]; extraDataPointer += 2
                let dataBuf = extraDataBuf.slice(extraDataPointer, extraDataPointer + length); extraDataPointer += length
                extraData[type] = dataBuf.buffer
            }
        }
        let name = null
        if (flagBits[3]) { // FNAME
            let nameNullIndex = buf.indexOf(0x00, pointer)
            let nameBuf = buf.slice(pointer, nameNullIndex); pointer += nameBuf.byteLength + 1
            name = new TextDecoder("iso-8859-1").decode(nameBuf)
        }
        let comment = null
        if (flagBits[4]) { // FCOMMENT
            let commentNullIndex = buf.indexOf(0x00, pointer)
            let commentBuf = buf.slice(pointer, commentNullIndex); pointer += commentBuf.byteLength + 1
            comment = new TextDecoder("iso-8859-1").decode(commentBuf)
        }
        let headerCrc16 = null
        if (flagBits[1]) { // FHCRC
            headerCrc16 = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // The 2 least significant bytes of the CRC32 of the header up to these 2 bytes
            let actualHeaderCrc16 = crc32(buf.slice(0, pointer - 2)) & 0xFFFF
            if (headerCrc16 != actualHeaderCrc16) throw new Error("[GZIP] Invalid data (Header data is invalid)")
        }

        // Parse member data
        let dataBuf = buf.slice(pointer).buffer
        let decompressed = inflate(dataBuf); pointer += decompressed.inputBufPointer // Decompress the data, skip to the end of the compressed data
        let data = decompressed.arrBuf
        if (isText) data = new TextDecoder().decode(new Uint8Array(data))

        // Parse member trailer
        let dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
        let actualDataCrc32 = crc32(decompressed.arrBuf)
        if (dataCrc32 != actualDataCrc32) throw new Error("[GZIP] Invalid data (Decompressed data is invalid)")
        let decompressedDataSize = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data size (modulo 2^32)
        if (decompressed.arrBuf.byteLength % 2**32 != decompressedDataSize) throw new Error("[GZIP] Invalid data (Decompressed size does not match expected value)")
        members.push({isText, data, info: {extraData, name, comment, modificationTime, os}})
    }
    return members
}
function inflate (arrBuf) { // DEFLATE spec: https://datatracker.ietf.org/doc/html/rfc1951
    function readBits (count, reverse = false) {
        if (count == 0) return 0

        let totalBytes = Math.ceil((bitPointer + count) / 8)
        let bytes = buf.slice(pointer, pointer + totalBytes).reverse()
        let bits = [...bytes].map(val => val.toString(2).padStart(8, "0")).join("")
        bits = bits.substring(bits.length - bitPointer - count, bits.length - bitPointer)
        if (reverse) bits = bits.split("").reverse().join("")
        let num = parseInt(bits, 2)

        pointer += Math.floor((bitPointer + count) / 8)
        bitPointer = (bitPointer + count) % 8
        return num
    }

    let output = []
    let buf = new Uint8Array(arrBuf)
    let pointer = 0
    let bitPointer = 0
    while (true) {
        if (pointer >= buf.byteLength) throw new Error("[INFLATE] Invalid data (Block did not end properly)")

        // Decompress block
        let isLastBlock = readBits(1) != 0
        let type = readBits(2) // enum - no compression, fixed Huffman codes, dynamic Huffman codes, reserved
        if (type == 3) throw new Error("[INFLATE] Invalid data (Block has invalid type)")
        if (type == 0) { // no compression
            pointer++, bitPointer = 0
            let length = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // The data length
            let lengthOnesComplement = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // One's complement of the data length

            let lengthBits = length.toString(2).padStart(16, "0")
            let lengthBits2 = lengthOnesComplement.toString(2).padStart(16, "0").split("").map(val => val == "0" ? "1" : "0").join("")
            if (lengthBits != lengthBits2) throw new Error("[INFLATE] Invalid data (Non-compressed block length is invalid)")

            let data = buf.slice(pointer, pointer + length); pointer += length // Literal data
            output.push(...data)
        } else {
            let literalLengthHuffmanTree = deflateFixedLiteralLengthHuffmanTree // For static blocks
            let distanceHuffmanTree = deflateFixedDistanceHuffmanTree // For static blocks
            if (type == 2) {
                let numLiteralLengthCodes = readBits(5) + 257
                let numDistanceCodes = readBits(5) + 1
                let numCodeLengthCodes = readBits(4) + 4

                let secondaryCodeLengths = new Array(deflateSecondaryCodeLengthsOrder.length).fill(0) // Decode secondary Huffman tree
                for (let i = 0; i < numCodeLengthCodes; i++) secondaryCodeLengths[deflateSecondaryCodeLengthsOrder[i]] = readBits(3)
                let secondaryHuffmanTree = createHuffmanTreeFromCodeLengths(secondaryCodeLengths)

                let inLengthCodesTemp = [numLiteralLengthCodes, numDistanceCodes] // Decode literal/length Huffman tree and distance Huffman tree
                let outTreesTemp = []
                let codeLengthsTemp = []
                let lastCodeTemp = null
                for (let i = 0; i < inLengthCodesTemp.length; i++) { // Is a loop because the 2 trees are parsed in the same way
                    for (let j = 0; j < inLengthCodesTemp[i]; j++) {
                        let val = decodeHuffmanCode(secondaryHuffmanTree, count => readBits(count, true)) // Decode value
                        if (val == null) throw new Error("[INFLATE] Invalid data (Dynamic block data is compressed invalidly)")
                        if (val <= 15) { // Literal value
                            lastCodeTemp = val
                            codeLengthsTemp.push(val)
                        } else if (val == 16) { // Short value repeat value
                            if (lastCodeTemp == null) throw new Error("[INFLATE] Invalid data (Dynamic block data is ordered invalidly)")
                            let count = readBits(2) + 3
                            codeLengthsTemp.push(...new Array(count).fill(lastCodeTemp))
                            j += count - 1
                        } else if (val == 17) { // Short 0 repeat value
                            lastCodeTemp = 0
                            let count = readBits(3) + 3
                            codeLengthsTemp.push(...new Array(count).fill(lastCodeTemp))
                            j += count - 1
                        } else if (val == 18) { // Long 0 repeat value
                            lastCodeTemp = 0
                            let count = readBits(7) + 11
                            codeLengthsTemp.push(...new Array(count).fill(lastCodeTemp))
                            j += count - 1
                        } else throw new Error("[INFLATE] Invalid data (Dynamic block data is invalid)")
                    }
                    let tree = createHuffmanTreeFromCodeLengths(codeLengthsTemp) // Create tree from code lengths
                    outTreesTemp.push(tree)
                    codeLengthsTemp = []
                }
                lastCodeTemp = null
                literalLengthHuffmanTree = outTreesTemp[0], distanceHuffmanTree = outTreesTemp[1] // Get trees
            }
            while (true) {
                let literalLengthVal = decodeHuffmanCode(literalLengthHuffmanTree, count => readBits(count, true)) // Decode literal/length value
                if (literalLengthVal == null) throw new Error("[INFLATE] Invalid data (Block data is compressed invalidly)")

                if (literalLengthVal <= 255) output.push(literalLengthVal) // Literal value
                else if (literalLengthVal == 256) break // End of block
                else if (literalLengthVal <= 285) { // Length value
                    let length = deflateLiteralLengthTable[literalLengthVal - 257] + readBits(deflateLiteralLengthExtraBitsTable[literalLengthVal - 257]) // Fully decode length value

                    let distanceVal = decodeHuffmanCode(distanceHuffmanTree, count => readBits(count, true)) // Decode distance value
                    if (distanceVal == null) throw new Error("[INFLATE] Invalid data (Block special data is compressed invalidly)")
                    let distance = deflateDistanceTable[distanceVal] + readBits(deflateDistanceExtraBitsTable[distanceVal]) // Fully decode distance value

                    let outputPointer = output.length - distance // Decode LZ77
                    for (let i = 0; i < length; i++) { // Is a loop due to the distance value being able to overlap the current pointer
                        let outputVal = output[outputPointer + i]
                        output.push(outputVal)
                    }
                } else throw new Error("[INFLATE] Invalid data (Block data is invalid)")
            }
        }
        if (isLastBlock) break
    }
    if (bitPointer != 0) pointer++, bitPointer = 0 // Ensure byte alignment
    let outputBuf = new Uint8Array(output).buffer // Make an ArrayBuffer from an Array
    return {arrBuf: outputBuf, inputBufPointer: pointer}
}
const deflateFixedLiteralLengthHuffmanTree = createHuffmanTreeFromCodeLengths([...new Array(144).fill(8), ...new Array(112).fill(9), ...new Array(24).fill(7), ...new Array(8).fill(8)])
const deflateFixedDistanceHuffmanTree = createHuffmanTreeFromCodeLengths([...new Array(32).fill(5)])
const deflateSecondaryCodeLengthsOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
const deflateLiteralLengthTable = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const deflateLiteralLengthExtraBitsTable = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const deflateDistanceTable = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const deflateDistanceExtraBitsTable = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
function createHuffmanTreeFromCodeLengths (codeLengths) { // codeLengths is an array of numbers which represent how long each Huffman code should be
    let codes = []
    let maxBits = codeLengths.toSorted((a, b) => b - a)[0]
    let numCodes = new Array(maxBits + 1).fill(0)
    for (let codeLength of codeLengths) numCodes[codeLength]++
    numCodes[0] = 0

    let code = 0
    let next_code = [0]
    for (let bits = 0; bits < maxBits; bits++) {
        code = (code + numCodes[bits]) << 1
        next_code[bits + 1] = code
    }

    for (let i = 0; i < codeLengths.length; i++) {
        let len = codeLengths[i]
        if (len != 0) {
            codes[i] = next_code[len].toString(2).padStart(codeLengths[i], "0")
            next_code[len]++
        }
    }
    return codes
}
function decodeHuffmanCode (tree, readBitsCallback) { // readBitsCallback is passed one argument, holding the number of bits to read (useful for streaming operations)
    let treeMinLength = tree.reduce((acc, val) => val.length < acc ? val.length : acc, Infinity)
    let treeMaxLength = tree.reduce((acc, val) => val.length > acc ? val.length : acc, 0)

    let rawVal = readBitsCallback(treeMinLength).toString(2).padStart(treeMinLength, "0")
    let val = null
    while (true) {
        val = tree.indexOf(rawVal)
        if (val > -1) return val // Found match
        
        if (rawVal.length >= treeMaxLength) return null // Failed to find match
        rawVal += readBitsCallback(1).toString(2) // Get another bit
    }
}
function zipFileDecompress (arrBuf) { // Decompress a .ZIP file (Does not support encryption)
    let structure = {}
    let buf = new Uint8Array(arrBuf)
    let pointer = 0

    // Find and parse the end of central directory record
    pointer = buf.findLastIndex((val, idx) => buf[idx] == 0x50 && buf[idx + 1] == 0x4B && buf[idx + 2] == 0x05 && buf[idx + 3] == 0x06); pointer += 4
    if (pointer == -1 + 4) throw new Error("[UNZIP] Invalid data (Failed to find the correct end of the file)")
    let currentDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    let centralDirStartDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    if (currentDisk != centralDirStartDisk) throw new Error("[UNZIP] Not implemented (Required data is on a different disk)")
    let centralDirRecordCountCurrentDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    let centralDirRecordCount = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    if (centralDirRecordCount != centralDirRecordCountCurrentDisk) throw new Error("[UNZIP] Not implemented (File data is split across multiple disks)")
    let centralDirSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
    let centralDirOffset = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
    let isZip64 = centralDirOffset == 0xFFFFFFFF
    if (isZip64) throw new Error("[UNZIP] Invalid data (Zip64 format is not supported)")
    let commentLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
    let commentBuf = buf.slice(pointer, pointer + commentLength); pointer += commentLength
    let comment = new TextDecoder().decode(commentBuf)

    // Parse central directory file headers
    let fileHeaders = []
    pointer = centralDirOffset
    let centralDirBuf = buf.slice(pointer, pointer + centralDirSize)
    for (let i = 0; i < centralDirRecordCount; i++) {
        if (buf[pointer] != 0x50 || buf[pointer + 1] != 0x4B || buf[pointer + 2] != 0x01 || buf[pointer + 3] != 0x02) throw new Error("[UNZIP] Invalid data (Directory file header starts with invalid bytes)"); pointer += 4
        let zipVersion = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let minUnzipVersion = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let flagBits = ((buf[pointer + 1] << 8) + buf[pointer]).toString(2).padStart(16, "0").split("").map(val => val != "0").reverse(); pointer += 2
        let compressionMethod = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // 0=None, 8=DEFLATE
        if (compressionMethod != 0 && compressionMethod != 8) throw new Error("[UNZIP] Not implemented (Unknown directory file compression method)")
        let modificationTime = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let modificationDate = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
        let compressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let decompressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let nameLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let extraDataLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let commentLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let fileDisk = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        if (fileDisk != currentDisk) throw new Error("[UNZIP] Not implemented (File is on a different disk)")
        let internalFileAttributes = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let externalFileAttributes = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let localFileHeaderOffset = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let nameBuf = buf.slice(pointer, pointer + nameLength); pointer += nameLength
        let name = new TextDecoder().decode(nameBuf)
        let extraData = buf.slice(pointer, pointer + extraDataLength).buffer; pointer += extraDataLength
        let commentBuf = buf.slice(pointer, pointer + commentLength); pointer += commentLength
        let comment = new TextDecoder().decode(commentBuf)
        fileHeaders.push({comment, internalFileAttributes, externalFileAttributes, localFileHeaderOffset})
    }

    // Parse local file headers
    for (let fileHeader of fileHeaders) {
        pointer = fileHeader.localFileHeaderOffset
        if (buf[pointer] != 0x50 || buf[pointer + 1] != 0x4B || buf[pointer + 2] != 0x03 || buf[pointer + 3] != 0x04) throw new Error("[UNZIP] Invalid data (Local file header starts with invalid bytes)"); pointer += 4
        let minUnzipVersion = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let flagBits = ((buf[pointer + 1] << 8) + buf[pointer]).toString(2).padStart(16, "0").split("").map(val => val != "0").reverse(); pointer += 2
        let compressionMethod = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2 // 0=None, 8=DEFLATE
        if (compressionMethod != 0 && compressionMethod != 8) throw new Error("[UNZIP] Not implemented (Unknown local file compression method)")
        let modificationTime = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let modificationDate = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
        let compressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let decompressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        let nameLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let extraDataLength = (buf[pointer + 1] << 8) + buf[pointer]; pointer += 2
        let nameBuf = buf.slice(pointer, pointer + nameLength); pointer += nameLength
        let name = new TextDecoder().decode(nameBuf)
        let extraData = buf.slice(pointer, pointer + extraDataLength).buffer; pointer += extraDataLength

        let data = null
        if (compressionMethod == 0) data = buf.slice(pointer, pointer + compressedSize).buffer, pointer += compressedSize
        else if (compressionMethod == 8) {
            let compressedData = buf.slice(pointer).buffer

            let decompressed = inflate(compressedData); pointer += decompressed.inputBufPointer // Decompress the data
            data = decompressed.arrBuf
        }
        if (flagBits[3]) { // Additional data descriptor - optional signature, crc32, compressed size, decompressed size
            if (buf[pointer] != 0x50 || buf[pointer + 1] != 0x4B || buf[pointer + 2] != 0x07 || buf[pointer + 3] != 0x08) throw new Error("[UNZIP] Not implemented (Additional data starts with unknown bytes)"); pointer += 4
            dataCrc32 = (BigInt(buf[pointer + 3]) << 24n) + (BigInt(buf[pointer + 2]) << 16n) + (BigInt(buf[pointer + 1]) << 8n) + BigInt(buf[pointer]); pointer += 4 // Decompressed data CRC32
            compressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
            decompressedSize = (buf[pointer + 3] << 24) + (buf[pointer + 2] << 16) + (buf[pointer + 1] << 8) + buf[pointer]; pointer += 4
        }

        if (data == null) throw new Error("[UNZIP] Invalid data (Failed to read file data)")
        if (data.byteLength != decompressedSize) throw new Error("[UNZIP] Invalid data (Decompressed data size is invalid)")
        let actualDataCrc32 = crc32(data)
        if (dataCrc32 != actualDataCrc32) throw new Error("[UNZIP] Invalid data (Decompressed data is invalid)")

        // Extract data structure
        let isDir = name.endsWith("/")
        let path = name.split("/")
        if (isDir) path.splice(-1, 1)
        let item = path.splice(-1, 1)[0]

        let currentPath = structure
        for (let pathPart of path) {
            if (currentPath[pathPart] == undefined) currentPath[pathPart] = {}
            currentPath = currentPath[pathPart]
        }
        if (isDir) {
            if (currentPath[item] == undefined) currentPath[item] = {}
        } else currentPath[item] = data
    }

    return structure
}

/* ***** COMPRESSION ***** */
function zipFileCompress (structure) { // Compress a .ZIP file (Does not support encryption) - Note: Not actually using compression
    function exploreStructure (structure, path = "") {
        let keys = Object.keys(structure)
        let names = [].concat(...keys.map(val => structure[val] instanceof ArrayBuffer ? {name: `${path}${val}`, val: structure[val]} : [{name: `${path}${val}/`, val: null}, ...exploreStructure(structure[val], `${path}${val}/`)]))
        return names
    }
    let files = exploreStructure(structure)

    let localFileHeaders = []
    let centralFileHeaders = []
    let tempOffset = 0x00
    for (let file of files) {
        let crc = crc32(file.val), size = file.val?.byteLength ?? 0, nameLen = file.name.length
        let crcArr = [crc & 0xFF, (crc >> 8) & 0xFF, (crc >> 16) & 0xFF, (crc >> 24) & 0xFF], sizeArr = [size & 0xFF, (size >> 8) & 0xFF, (size >> 16) & 0xFF, (size >> 24) & 0xFF]
        let nameLenArr = [nameLen & 0xFF, (nameLen >> 8) & 0xFF]
        localFileHeaders.push([
            0x50, 0x4B, 0x03, 0x04, // magic
            0x14, 0x00, // min extractor version
            0x00, 0x00, 0x00, 0x00, // flags, compression method
            0x00, 0x00, 0x00, 0x00, // last modification time/date
            ...crcArr, // uncompressed data crc32
            ...sizeArr, // compressed data size
            ...sizeArr, // uncompressed data size
            ...nameLenArr, // name length
            0x00, 0x00, // extra data length
            ...new TextEncoder().encode(file.name), // file name
            ...new Uint8Array(file.val ?? 0), // file data
        ])

        let tempOffsetArr = [tempOffset & 0xFF, (tempOffset >> 8) & 0xFF, (tempOffset >> 16) & 0xFF, (tempOffset >> 24) & 0xFF]
        centralFileHeaders.push([
            0x50, 0x4B, 0x01, 0x02, // magic
            0x14, 0x03, 0x14, 0x00, // compressor version, min extractor version
            0x00, 0x00, 0x00, 0x00, // flags, compression method
            0x00, 0x00, 0x00, 0x00, // last modification time/date
            ...crcArr, // uncompressed data crc32
            ...sizeArr, // compressed data size
            ...sizeArr, // uncompressed data size
            ...nameLenArr, // name length
            0x00, 0x00, // extra data length
            0x00, 0x00, // file comment length
            0x00, 0x00, // file data disk
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // internal/external file attributes
            ...tempOffsetArr, // offset to local file header from start of file disk
            ...new TextEncoder().encode(file.name), // file name
        ])
        tempOffset += localFileHeaders.at(-1).length
    }

    let centralFileHeadersLengthArr = [centralFileHeaders.length & 0xFF, (centralFileHeaders.length >> 8) & 0xFF]
    let centralHeadersSizeArr = [tempOffset & 0xFF, (tempOffset >> 8) & 0xFF, (tempOffset >> 16) & 0xFF, (tempOffset >> 24) & 0xFF]
    let endRecord = [
        0x50, 0x4B, 0x05, 0x06, // magic
        0x00, 0x00, 0x00, 0x00, // this disk, central headers start disk
        ...centralFileHeadersLengthArr, // number of central headers on this disk
        ...centralFileHeadersLengthArr, // number of central headers
        ...centralHeadersSizeArr, // size of all central headers
        ...centralHeadersSizeArr, // central headers start location
        0x00, 0x00, // comment length
    ]

    let arrBuf = new Uint8Array([
        ...[].concat(...localFileHeaders),
        ...[].concat(...centralFileHeaders),
        ...endRecord,
    ]).buffer
    return arrBuf
}

/* ***** DECOMPRESSION/COMPRESSION ***** */

/* ***** DECODING ***** */
function decodeBase64 (arrBuf, urlMode = false) { // Decode Base64 (The urlMode argument specifies whether certain special characters can be replaced by others automatically)
    let buf = new Uint8Array(arrBuf)
    let outArr = []

    let numbers = [...buf]
    if (urlMode) numbers = numbers.map(val => val == "-".charCodeAt(0) ? "+".charCodeAt(0) : val).map(val => val == "_".charCodeAt(0) ? "/".charCodeAt(0) : val) // Replace certain special characters
    for (let i = 0; i < numbers.length; i++) { // Check for invalid data
        if (base64Table.indexOf(numbers[i]) == -1 && numbers[i] != "=".charCodeAt(0)) throw new Error("[BASE64] Invalid data (Data contains invalid characters)")
    }
    let binStr = numbers.map(val => base64Table.indexOf(val)).filter(val => val > -1).map(val => val.toString(2).padStart(6, "0")).map(val => val.substring(val.length - 6)).join("") // Binary string

    for (let i = 0; i < binStr.length; i += 8) { // Split the binary string
        let bin = binStr.substring(i, i + 8)
        if (bin.length < 8) break // Discard small last group
        outArr.push(parseInt(bin, 2)) // Parse number from binary
    }
    return new Uint8Array(outArr).buffer // Make an ArrayBuffer from an Array
}

/* ***** ENCODING ***** */
function encodeBase64 (arrBuf) { // Encode Base64
    let buf = new Uint8Array(arrBuf)
    let outArr = []
    
    let binStr = [...buf].map(val => val.toString(2).padStart(8, "0")).join("")
    for (let i = 0; i < binStr.length; i += 6) {
        let padding = "0".repeat(Math.max(0, (i + 6) - binStr.length)) // Pad small last group
        let bin = binStr.slice(i, i + 6) + padding
        outArr.push(base64Table[parseInt(bin, 2)]) // Find the character representing the binary string part
    }
    let padding = new Array(4 - ((outArr.length % 4) || 4)).fill(61) // Pad output
    outArr.push(...padding)
    return new Uint8Array(outArr).buffer // Make an ArrayBuffer from an Array
}

/* ***** DECODING/ENCODING ***** */
const base64Table = []
for (let c = 65; c <= 90; c++) base64Table.push(c) // A-Z
for (let c = 97; c <= 122; c++) base64Table.push(c) // a-z
for (let c = 48; c <= 57; c++) base64Table.push(c) // 0-9
base64Table.push(...["+", "/"].map(val => val.charCodeAt(0))) // +,/
function xorWithKey (arrBuf, key) { // XOR
    let buf = new Uint8Array(arrBuf)
    buf = buf.map(val => val ^ key)
    return buf.buffer
}

/* ***** UTIL ***** */
const crc32Table = makeCRC32Table()
function makeCRC32Table () { // Initializes the CRC32 table
    let crc32Table = []
    let temp = null
    for (let i = 0; i < 256; i++) {
        temp = i
        for (let j = 0; j < 8; j++) temp = ((temp & 1) ? (0xEDB88320 ^ (temp >>> 1)) : (temp >>> 1))
        crc32Table[i] = temp
    }
    return crc32Table
}
function crc32 (arrBuf) { // Calculate a CRC32
    let buf = new Uint8Array(arrBuf)
    let out = 0 ^ -1
    for (let i = 0; i < buf.byteLength; i++) out = (out >>> 8) ^ crc32Table[(out ^ buf[i]) & 0xFF]
    return (out ^ -1) >>> 0
}
