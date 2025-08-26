let resultBFWSD = null
let resultNameBFWSD = null
let inFileTypesBFWSD = ["bfwsd"]
let outFileTypeBFWSD = "json"
async function decompressFileFromBFWSD () {
    let file = await importFile(inFileTypesBFWSD)
    let fileBuf = new FileBuf(file.buf)
    resultBFWSD = decompressFromBFWSD(fileBuf)
    resultNameBFWSD = file.name
}
async function downloadResultBFWSD () {
    await exportFile(resultBFWSD, resultNameBFWSD, outFileTypeBFWSD)
}
let bfwsd_data = null
const bfwsd_fileTypes = [
    undefined,
    "Sound",
    "Sound group",
    "Bank",
    "Player",
    "Wave archive",
    "Group",
]
const bfwsd_fileTypeIds = [
    undefined,
    ["SE", "WSD", "STRM"],
    ["WSDSET", "SEQSET"],
    ["BANK"],
    ["PLAYER"],
    ["WAR"],
    ["GROUP"],
]
function decompressFromBFWSD (fileBuf) {
    let numMode = null
    let header = fileBuf.buf(0x00, 0x14)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, "FWSD", "BFWSD header does not start with 'FWSD'")
        let header_byteOrder = header.int(0x04, IntSize.U16, Endian.BIG)
            header_byteOrder = header_byteOrder.toString(16)
            if (header_byteOrder == "feff") numMode = Endian.BIG
            else if (header_byteOrder == "fffe") numMode = Endian.LITTLE
        let header_sizeAndBlockReferences = header.int(0x06, IntSize.U16, numMode)
        let header_version = header.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(header_version, [0x010100], "BFWSD header states an unknown/unsupported version")
        let header_fileSize = header.int(0x0C, IntSize.U32, numMode)
            FileBuf.expectVal(header_fileSize, fileBuf.data.byteLength, "BFWSD header states invalid file size")
        let header_numBlocks = header.int(0x10, IntSize.U16, numMode)
        let header_padding = header.int(0x12, IntSize.U16, numMode)
    let blockReferencesBuf = fileBuf.buf(0x14, Math.ceil((header_sizeAndBlockReferences - 0x14) / 32) * 32)
        let blockReferences = new Array(header_numBlocks)
        for (let i = 0; i < header_numBlocks; i++) {
            let id = blockReferencesBuf.int(i * 0x0C, IntSize.U16, numMode)
            let padding = blockReferencesBuf.int((i * 0x0C) + 0x02, IntSize.U16, numMode)
            let offset = blockReferencesBuf.int((i * 0x0C) + 0x04, IntSize.U32, numMode)
            let size = blockReferencesBuf.int((i * 0x0C) + 0x08, IntSize.U32, numMode)
            blockReferences[i] = {id, offset, size}
        }
        for (let i = 0; i < blockReferences.length; i++) bfwsd_parseBlock(fileBuf, numMode, blockReferences[i].id, blockReferences[i].offset, blockReferences[i].size)
    
    return bfwsd_getJsonBuf(bfwsd_data)
}
function bfwsd_parseBlock (fileBuf, numMode, id, offset, size) {
    let buf = fileBuf.buf(offset, size)
        let idStr = buf.str(0x00, 0x04)
        let size2 = buf.int(0x04, IntSize.U32, numMode)
        FileBuf.expectVal(size, size2, "Block size data doesn't match")
        if (id == 0x6800 && idStr == "INFO") {
            let waveIdTableReference = bfwsd_parseReference(buf, numMode, 0x08, 0x0100, "Wave id table")
                let numWaveIds = buf.int(waveIdTableReference.offsetRel + 0x08, IntSize.U32, numMode)
                let waveIds = new Array(numWaveIds)
                for (let i = 0; i < numWaveIds; i++) {
                    let waveArchiveItemId = bfwsd_parseItemId(buf, numMode, waveIdTableReference.offsetRel +  (i * 0x08) + 0x0C, "Wave archive", "Wave id")
                        let waveArchiveFileIndex = waveArchiveItemId.fileIndex
                    let waveFileIndex = buf.int(waveIdTableReference.offsetRel +  (i * 0x08) + 0x10, IntSize.U32, numMode)
                    waveIds[i] = {
                        waveArchiveFileIndex,
                        waveFileIndex,
                    }
                }
            let waveSoundDataTableReference = bfwsd_parseReference(buf, numMode, 0x10, 0x0101, "Wave sound data table")
                let waveSoundDataTable = bfwsd_parseReferenceTable(buf, numMode, waveSoundDataTableReference.offsetRel + 0x08, 0x4900, "Wave sound data")
                    let waveSoundDatas = new Array(waveSoundDataTable.length)
                    for (let i = 0; i < waveSoundDataTable.length; i++) {
                        let waveSoundDataBufStart = waveSoundDataTableReference.offsetRel + 0x08 + waveSoundDataTable[i].offsetRel
                        let waveSoundDataBuf = buf.buf(waveSoundDataBufStart, buf.data.byteLength - waveSoundDataBufStart)
                            let waveSoundInfoReference = bfwsd_parseReference(waveSoundDataBuf, numMode, 0x00, 0x4901, "Wave sound info")
                                let waveSoundInfoFlagsRaw = waveSoundDataBuf.int(waveSoundInfoReference.offsetRel, IntSize.U32, numMode)
                                    let waveSoundInfoFlags = {
                                        surroundPan: null,
                                        pan: null,
                                        pitch: null,
                                        biquadValue: null,
                                        biquadType: null,
                                        lowPassFilterFreq: null,
                                        sendValue: null,
                                        adshrCurve: null,
                                    }
                                    let flagsPointer = waveSoundInfoReference.offsetRel + 0x04
                                    if (waveSoundInfoFlagsRaw & 0x1) {
                                        let arr = waveSoundDataBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                        let padding = arr.slice(0, 2)
                                        waveSoundInfoFlags.surroundPan = arr[2], waveSoundInfoFlags.pan = arr[3]
                                    }
                                    if (waveSoundInfoFlagsRaw & 0x2) waveSoundInfoFlags.pitch = FileBuf.float_int(waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode), FloatPrecision.SINGLE), flagsPointer += 0x04
                                    if (waveSoundInfoFlagsRaw & 0x4) {
                                        let arr = waveSoundDataBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                        let padding = arr.slice(0, 1)
                                        waveSoundInfoFlags.biquadValue = arr[1], waveSoundInfoFlags.biquadType = arr[2], waveSoundInfoFlags.lowPassFilterFreq = arr[3]
                                    }
                                    if (waveSoundInfoFlagsRaw & 0x100) {
                                        let sendValueOffset = waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                        waveSoundInfoFlags.sendValue = waveSoundDataBuf.arr(waveSoundInfoReference.offsetRel + sendValueOffset, IntSize.U32, numMode)
                                    }
                                    if (waveSoundInfoFlagsRaw & 0x200) {
                                        let adshrCurveOffset = waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                        let adshrCurveReference = bfwsd_parseReference(waveSoundDataBuf, numMode, waveSoundInfoReference.offsetRel + adshrCurveOffset, 0x0000, "ADSHR curve")
                                            let adshrCurve = waveSoundDataBuf.arr(waveSoundInfoReference.offsetRel + adshrCurveOffset + adshrCurveReference.offsetRel, 0x05, Endian.BIG)
                                            waveSoundInfoFlags.adshrCurve = {
                                                attack: adshrCurve[0],
                                                decay: adshrCurve[1],
                                                sustain: adshrCurve[2],
                                                hold: adshrCurve[3],
                                                release: adshrCurve[4],
                                            }
                                    }
                                let waveSoundInfo = {
                                    flags: waveSoundInfoFlags,
                                }
                            let trackInfoTableReference = bfwsd_parseReference(waveSoundDataBuf, numMode, 0x08, 0x0101, "Track info table")
                                let trackInfoTable = bfwsd_parseReferenceTable(waveSoundDataBuf, numMode, trackInfoTableReference.offsetRel, 0x4903, "Track info")
                                    let trackInfos = new Array(trackInfoTable.length)
                                    for (let j = 0; j < trackInfoTable.length; j++) {
                                        let noteEventTableReference = bfwsd_parseReference(waveSoundDataBuf, numMode, trackInfoTableReference.offsetRel + trackInfoTable[j].offsetRel, 0x0000, "Note event table")
                                            let noteEventTable = bfwsd_parseReferenceTable(waveSoundDataBuf, numMode, trackInfoTableReference.offsetRel + trackInfoTable[j].offsetRel + noteEventTableReference.offsetRel, 0x4904, "Note event")
                                                let noteEvents = new Array(noteEventTable.length)
                                                for (let k = 0; k < noteEventTable.length; k++) {
                                                    let noteEventBufStart = trackInfoTableReference.offsetRel + trackInfoTable[j].offsetRel + noteEventTableReference.offsetRel + noteEventTable[k].offsetRel
                                                    let noteEventBuf = waveSoundDataBuf.buf(noteEventBufStart, waveSoundDataBuf.data.byteLength - noteEventBufStart)
                                                        let position = FileBuf.float_int(noteEventBuf.int(0x00, IntSize.U32, numMode), FloatPrecision.SINGLE)
                                                        let length = FileBuf.float_int(noteEventBuf.int(0x04, IntSize.U32, numMode), FloatPrecision.SINGLE)
                                                        let noteInfoIndex = noteEventBuf.int(0x08, IntSize.U32, numMode)
                                                    noteEvents[k] = {
                                                        position,
                                                        length,
                                                        noteInfo: {
                                                            index: noteInfoIndex,
                                                        },
                                                    }
                                                }
                                        trackInfos[j] = {
                                            noteEvents,
                                        }
                                    }
                            let noteInfoTableReference = bfwsd_parseReference(waveSoundDataBuf, numMode, 0x10, 0x0101, "Note info table")
                                let noteInfoTable = bfwsd_parseReferenceTable(waveSoundDataBuf, numMode, noteInfoTableReference.offsetRel, 0x4902, "Note info")
                                    let noteInfos = new Array(noteInfoTable.length)
                                    for (let j = 0; j < noteInfoTable.length; j++) {
                                        let waveIdTableIndex = waveSoundDataBuf.int(noteInfoTableReference.offsetRel + noteInfoTable[j].offsetRel, IntSize.U32, numMode)
                                            let waveId = waveIds[waveIdTableIndex]
                                        let flagsRaw = waveSoundDataBuf.int(noteInfoTableReference.offsetRel + noteInfoTable[j].offsetRel + 0x04, IntSize.U32, numMode)
                                            let flags = {
                                                origKey: null,
                                                volume: null,
                                                surroundPan: null,
                                                pan: null,
                                                pitch: null,
                                                adshrCurve: null,
                                            }
                                            let flagsPointer = noteInfoTableReference.offsetRel + noteInfoTable[j].offsetRel + 0x08
                                            if (flagsRaw & 0x1) flags.origKey = waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                            if (flagsRaw & 0x2) flags.volume = waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                            if (flagsRaw & 0x4) {
                                                let arr = waveSoundDataBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                                let padding = arr.slice(0, 2)
                                                flags.surroundPan = arr[2], flags.pan = arr[3]
                                            }
                                            if (flagsRaw & 0x8) flags.pitch = FileBuf.float_int(waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode), FloatPrecision.SINGLE), flagsPointer += 0x04
                                            if (flagsRaw & 0x200) {
                                                let adshrCurveOffset = waveSoundDataBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                                let adshrCurveReference = bfwsd_parseReference(waveSoundDataBuf, numMode, noteInfoTableReference.offsetRel + noteInfoTable[j].offsetRel + 0x04 + adshrCurveOffset, 0x0000, "ADSHR curve")
                                                    let adshrCurve = waveSoundDataBuf.arr(noteInfoTableReference.offsetRel + noteInfoTable[j].offsetRel + 0x04 + adshrCurveOffset + adshrCurveReference.offsetRel, 0x05, Endian.BIG)
                                                    waveSoundInfoFlags.adshrCurve = {
                                                        attack: adshrCurve[0],
                                                        decay: adshrCurve[1],
                                                        sustain: adshrCurve[2],
                                                        hold: adshrCurve[3],
                                                        release: adshrCurve[4],
                                                    }
                                            }
                                        noteInfos[j] = {
                                            waveId,
                                            flags,
                                        }
                                    }
                        for (let j = 0; j < trackInfos.length; j++) {
                            for (let k = 0; k < trackInfos[j].noteEvents.length; k++) trackInfos[j].noteEvents[k].noteInfo = noteInfos[trackInfos[j].noteEvents[k].noteInfo.index]
                        }
                        waveSoundDatas[i] = {
                            waveSoundInfo,
                            trackInfos,
                        }
                    }
                        bfwsd_data = waveSoundDatas
        } else FileBuf.expectVal(0, 1, `Unknown or unmatching block id "0x${id.toString(16).padStart(4, "0").toUpperCase()}" and block id string "${idStr}"`)
}
function bfwsd_parseReference (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let id = fileBuf.int(offset, IntSize.U16, numMode)
    let padding = fileBuf.int(offset + 0x02, IntSize.U16, numMode)
    let offsetRel = fileBuf.int(offset + 0x04, IntSize.U32, numMode)

    let isPresent = id != 0x0000 || offsetRel != 0xFFFFFFFF
        if (!isPresent) id = null, offsetRel = null
    if (isPresent && expectedId != null) FileBuf.expectVal(id, expectedId, `Invalid reference: ${expectedIdMsg == null ? `<generic>` : expectedIdMsg}`)
    return {id, offsetRel, isPresent}
}
function bfwsd_parseItemId (fileBuf, numMode, offset, expectedFileType = null, expectedFileTypeMsg = null) {
    let arr = fileBuf.arr(offset, 0x04, numMode)
    let fileType = arr[0], fileIndex = (arr[1] << 16) + (arr[2] << 8) + arr[3]

    let isPresent = fileType != 0xFF || fileIndex != 0xFFFFFF
        if (!isPresent) fileType = null, fileIndex = null
    if (isPresent && expectedFileType != null) FileBuf.expectVal(bfwsd_fileTypes[fileType], expectedFileType, `Invalid item id: ${expectedFileTypeMsg == null ? `<generic>` : expectedFileTypeMsg}`)
    return {fileType, fileIndex, isPresent}
}
function bfwsd_parseReferenceTable (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let numReferences = fileBuf.int(offset, IntSize.U32, numMode)
        let references = new Array(numReferences)
        for (let i = 0; i < numReferences; i++) references[i] = bfwsd_parseReference(fileBuf, numMode, offset + 0x04 + (i * 0x08), expectedId, expectedIdMsg)
    return references
}
function bfwsd_getJsonBuf (obj) {
    return new TextEncoder().encode(JSON.stringify(obj, null, 4) + "\n").buffer
}
