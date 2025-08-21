let resultBFSAR = null
let resultNameBFSAR = null
let inFileTypesBFSAR = ["bfsar"]
let outFileTypeBFSAR = "zip"
async function decompressFileFromBFSAR () {
    let file = await importFile(inFileTypesBFSAR)
    let fileBuf = new FileBuf(file.buf)
    resultBFSAR = decompressFromBFSAR(fileBuf)
    resultNameBFSAR = file.name
}
async function downloadResultBFSAR () {
    await exportZip(resultBFSAR, resultNameBFSAR)
}
let bfsar_stringTable = null
let bfsar_searchTreeStartIndex = null
let bfsar_searchTree = null
let bfsar_fileInfoData = null
const bfsar_fileTypes = [
    undefined,
    "Sound",
    "Sound group",
    "Bank",
    "Player",
    "Wave archive",
    "Group",
]
const bfsar_fileTypeIds = [
    undefined,
    ["SE", "WSD", "STRM"],
    ["WSDSET", "SEQSET"],
    ["BANK"],
    ["PLAYER"],
    ["WAR"],
    ["GROUP"],
]
function decompressFromBFSAR (fileBuf) {
    let numMode = null
    let header = fileBuf.buf(0x00, 0x14)
        let header_name = header.str(0x00, 0x04)
            FileBuf.expectVal(header_name, "FSAR", "BFSAR header does not start with 'FSAR'")
        let header_byteOrder = header.int(0x04, IntSize.U16, Endian.BIG)
            header_byteOrder = header_byteOrder.toString(16)
            if (header_byteOrder == "feff") numMode = Endian.BIG
            else if (header_byteOrder == "fffe") numMode = Endian.LITTLE
        let header_sizeAndBlockReferences = header.int(0x06, IntSize.U16, numMode)
        let header_version = header.int(0x08, IntSize.U32, numMode)
            FileBuf.expectVal(header_version, [0x020400/*, 0x020300*/], "BFSAR header states an unknown/unsupported version")
        let header_fileSize = header.int(0x0C, IntSize.U32, numMode)
            FileBuf.expectVal(header_fileSize, fileBuf.data.byteLength, "BFSAR header states invalid file size")
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
        for (let i = 0; i < blockReferences.length; i++) bfsar_parseBlock(fileBuf, numMode, blockReferences[i].id, blockReferences[i].offset, blockReferences[i].size)

    let rawFiles = {}
        for (let i = 0; i < bfsar_fileInfoData.fileInfos.length; i++) {
            let fileInfo = bfsar_fileInfoData.fileInfos[i]
            if (fileInfo.fileType == "Internal" && !fileInfo.fileData.isInGroupFile) rawFiles[`raw${i}.bin`] = fileInfo.fileData.content
        }
    return {
        "rawfiles": {
            "info.json": bfsar_getJsonBuf(bfsar_fileInfoData.fileInfos.map((val, idx) => ({
                fileIndex: idx,
                fileType: val.fileType,
                fileData: {
                    isInGroupFile: val.fileData.isInGroupFile,
                    groupTable: val.fileData.groupTable,
                    name: val.fileData.name,
                },
            }))),
            ...rawFiles,
        },
        "maininfo.json": bfsar_getJsonBuf(bfsar_fileInfoData.mainInfo),
        "searchtree.json": bfsar_getJsonBuf({
            startIndex: bfsar_searchTreeStartIndex,
            tree: bfsar_searchTree,
        }),

        "sounds.json": bfsar_getJsonBuf(bfsar_fileInfoData.soundInfos),
        "soundgroups.json": bfsar_getJsonBuf(bfsar_fileInfoData.soundGroupInfos),
        "banks.json": bfsar_getJsonBuf(bfsar_fileInfoData.bankInfos),
        "wavearchives.json": bfsar_getJsonBuf(bfsar_fileInfoData.waveArchiveInfos),
        "groups.json": bfsar_getJsonBuf(bfsar_fileInfoData.groupInfos),
        "players.json": bfsar_getJsonBuf(bfsar_fileInfoData.playerInfos),
    }
}
function bfsar_parseBlock (fileBuf, numMode, id, offset, size) {
    let buf = fileBuf.buf(offset, size)
        let idStr = buf.str(0x00, 0x04)
        let size2 = buf.int(0x04, IntSize.U32, numMode)
        FileBuf.expectVal(size, size2, "Block size data doesn't match")
        if (id == 0x2000 && idStr == "STRG") {
            let stringTableReference = bfsar_parseReference(buf, numMode, 0x08, 0x2400, "String table")
                let stringTable = buf.buf(stringTableReference.offsetRel + 0x08, size - stringTableReference.offsetRel - 0x08)
                    let stringTable_numStrings = stringTable.int(0x00, IntSize.U32, numMode)
                    let stringTable_entriesBuf = stringTable.buf(0x04, stringTable_numStrings * 0x0C)
                        let stringTable_entries = new Array(stringTable_numStrings)
                        for (let i = 0; i < stringTable_numStrings; i++) {
                            let reference = bfsar_parseReference(stringTable_entriesBuf, numMode, i * 0x0C, 0x1F01, "String")
                            let sizeWithNull = stringTable_entriesBuf.int((i * 0x0C) + 0x08, IntSize.U32, numMode)
                            stringTable_entries[i] = {offsetRel: reference.offsetRel, sizeWithNull}
                        }
                        let stringTable_strings = new Array(stringTable_numStrings)
                        for (let i = 0; i < stringTable_entries.length; i++) stringTable_strings[i] = stringTable.str(stringTable_entries[i].offsetRel, stringTable_entries[i].sizeWithNull - 1)
                            bfsar_stringTable = stringTable_strings
            let searchTreeReference = bfsar_parseReference(buf, numMode, 0x10, 0x2401, "Search tree")
                let searchTree = buf.buf(searchTreeReference.offsetRel + 0x08, size - searchTreeReference.offsetRel - 0x08)
                    let searchTree_rootNodeIndex = searchTree.int(0x00, IntSize.U32, numMode)
                        bfsar_searchTreeStartIndex = searchTree_rootNodeIndex
                    let searchTree_numNodes = searchTree.int(0x04, IntSize.U32, numMode)
                    let searchTree_nodesBuf = searchTree.buf(0x08, searchTree_numNodes * 0x14)
                        let searchTree_nodes = new Array(searchTree_numNodes)
                        for (let i = 0; i < searchTree_numNodes; i++) {
                            let isLeaf = searchTree_nodesBuf.int(i * 0x14, IntSize.U16, numMode) == 0x01
                            let stringBitIndex = searchTree_nodesBuf.int((i * 0x14) + 0x02, IntSize.U16, numMode)
                                if (stringBitIndex == 0xFFFF) stringBitIndex = null
                                if (isLeaf) FileBuf.expectVal(stringBitIndex, null, "Invalid string search tree node string bit index")
                                else if (stringBitIndex == null) FileBuf.expectVal(0, 1, "Invalid string search tree node string bit index")
                            let leftChildIndex = searchTree_nodesBuf.int((i * 0x14) + 0x04, IntSize.U32, numMode)
                                if (leftChildIndex == 0xFFFFFFFF) leftChildIndex = null
                                if (isLeaf) FileBuf.expectVal(leftChildIndex, null, "Invalid string search tree node left child index")
                                else if (leftChildIndex == null) FileBuf.expectVal(0, 1, "Invalid string search tree node left child index")
                            let rightChildIndex = searchTree_nodesBuf.int((i * 0x14) + 0x08, IntSize.U32, numMode)
                                if (rightChildIndex == 0xFFFFFFFF) rightChildIndex = null
                                if (isLeaf) FileBuf.expectVal(rightChildIndex, null, "Invalid string search tree node right child index")
                                else if (rightChildIndex == null) FileBuf.expectVal(0, 1, "Invalid string search tree node right child index")
                            let stringTableIndex = searchTree_nodesBuf.int((i * 0x14) + 0x0C, IntSize.U32, numMode)
                                let string = stringTableIndex == 0xFFFFFFFF ? null : stringTable_strings[stringTableIndex]
                            let itemId = bfsar_parseItemId(searchTree_nodesBuf, numMode, (i * 0x14) + 0x10)
                                let fileType = itemId.fileType, fileIndex = itemId.fileIndex
                                if (itemId.isPresent) fileType = bfsar_fileTypes[fileType]
                                    if (!isLeaf) FileBuf.expectVal(fileType, null, "Invalid string search tree node item id")
                                    else if (fileType == null) FileBuf.expectVal(0, 1, "Invalid string search tree node item id")
                                    if (!isLeaf) FileBuf.expectVal(fileIndex, null, "Invalid string search tree node item id")
                                    else if (fileIndex == null) FileBuf.expectVal(0, 1, "Invalid string search tree node item id")
                            searchTree_nodes[i] = {
                                isLeaf,
                                stringBitIndex,
                                leftChildIndex,
                                rightChildIndex,
                                string,
                                fileType,
                                fileIndex,
                            }
                        }
                            bfsar_searchTree = searchTree_nodes
        } else if (id == 0x2001 && idStr == "INFO") {
            let soundInfoTableReference = bfsar_parseReference(buf, numMode, 0x08, 0x2100, "Sound info table")
                let soundInfoTable = bfsar_parseReferenceTable(buf, numMode, soundInfoTableReference.offsetRel + 0x08, 0x2200, "Sound info")
                    let soundInfos = new Array(soundInfoTable.length)
                    for (let i = 0; i < soundInfoTable.length; i++) {
                        let soundInfoBufStart = soundInfoTableReference.offsetRel + 0x08 + soundInfoTable[i].offsetRel
                        let soundInfoBuf = buf.buf(soundInfoBufStart, buf.data.byteLength - soundInfoBufStart)
                            let fileIndex = soundInfoBuf.int(0x00, IntSize.U32, numMode)
                            let playerItemId = bfsar_parseItemId(soundInfoBuf, numMode, 0x04, "Player", "Sound info player")
                                let playerFileIndex = playerItemId.fileIndex
                            let initialVolume = soundInfoBuf.int(0x08, IntSize.U8, numMode)
                            let remoteFilter = soundInfoBuf.int(0x09, IntSize.U8, numMode)
                            let padding = soundInfoBuf.int(0x0A, IntSize.U16, numMode)
                            let infoReference = bfsar_parseReference(soundInfoBuf, numMode, 0x0C, [0x2201, 0x2202, 0x2203], "Sound info")
                                let infoBuf = soundInfoBuf.buf(infoReference.offsetRel, soundInfoBuf.data.byteLength - infoReference.offsetRel)
                                    let infoType = null
                                    if (infoReference.id == 0x2201) infoType = "Stream"
                                    else if (infoReference.id == 0x2202) infoType = "Wave"
                                    else if (infoReference.id == 0x2203) infoType = "Sequence"
                                    let infoData = null
                                    if (infoType == "Stream") {
                                        let validTrackBitmask = infoBuf.int(0x00, IntSize.U16, numMode)
                                        let numChannels = infoBuf.int(0x02, IntSize.U16, numMode)
                                        let trackInfoTableReference = bfsar_parseReference(infoBuf, numMode, 0x04, 0x0101, "Track info table")
                                            let trackInfoTable = bfsar_parseReferenceTable(infoBuf, numMode, trackInfoTableReference.offsetRel, 0x220E, "Track info")
                                                let trackInfos = new Array(trackInfoTable.length)
                                                for (let j = 0; j < trackInfoTable.length; j++) {
                                                    let trackInfoBufStart = trackInfoTableReference.offsetRel + trackInfoTable[j].offsetRel
                                                    let trackInfoBuf = infoBuf.buf(trackInfoBufStart, infoBuf.data.byteLength - trackInfoBufStart)
                                                        let unknown1 = trackInfoBuf.int(0x00, IntSize.U8, numMode)
                                                        let unknown2 = trackInfoBuf.int(0x01, IntSize.U8, numMode)
                                                        let unknown3 = trackInfoBuf.int(0x02, IntSize.U8, numMode)
                                                        let unknown4 = trackInfoBuf.int(0x03, IntSize.U8, numMode)
                                                        let channelInfoReference = bfsar_parseReference(trackInfoBuf, numMode, 0x04, 0x0100, "Channel info")
                                                            let numChannelIndexes = trackInfoBuf.int(channelInfoReference.offsetRel, IntSize.U32, numMode)
                                                            let channelIndexes = new Array(numChannelIndexes)
                                                            for (let k = 0; k < numChannelIndexes; k++) channelIndexes[k] = trackInfoBuf.int(channelInfoReference.offsetRel + 0x04 + k, IntSize.U8, numMode)
                                                        let sendValueReference = bfsar_parseReference(trackInfoBuf, numMode, 0x0C, 0x220F, "Track send value")
                                                            let sendValueRaw = trackInfoBuf.arr(sendValueReference.offsetRel, IntSize.U32, numMode)
                                                            let sendValue = [sendValueRaw[0], (sendValueRaw[1] << 8) + sendValueRaw[2], sendValueRaw[3]]
                                                        let unknown5 = trackInfoBuf.int(0x14, IntSize.U8, numMode)
                                                        let unknown6 = trackInfoBuf.int(0x15, IntSize.U8, numMode)
                                                        let padding = trackInfoBuf.int(0x16, IntSize.U16, numMode)
                                                    trackInfos[j] = {
                                                        unknown1,
                                                        unknown2,
                                                        unknown3,
                                                        unknown4,
                                                        channelIndexes,
                                                        sendValue,
                                                        unknown5,
                                                        unknown6,
                                                    }
                                                }
                                        let unknown1 = FileBuf.float_int(infoBuf.int(0x0C, IntSize.U32, numMode), FloatPrecision.SINGLE)
                                        let sendValueReference = bfsar_parseReference(infoBuf, numMode, 0x10, 0x220F, "Sound info send value")
                                            let sendValueRaw = infoBuf.arr(sendValueReference.offsetRel, IntSize.U32, numMode)
                                            let sendValue = [sendValueRaw[0], (sendValueRaw[1] << 8) + sendValueRaw[2], sendValueRaw[3]]
                                        let streamSoundExtensionReference = bfsar_parseReference(infoBuf, numMode, 0x18, 0x2210, "Stream sound extension")
                                            let streamSoundExtension = null
                                            if (streamSoundExtensionReference.isPresent) streamSoundExtension = infoBuf.int(streamSoundExtensionReference.offsetRel, IntSize.U32, numMode)
                                        let prefetchFileIndex = infoBuf.int(0x20, IntSize.U32, numMode)
                                            if (prefetchFileIndex == 0xFFFFFFFF) prefetchFileIndex = null
                                        infoData = {
                                            validTrackBitmask,
                                            numChannels,
                                            trackInfos,
                                            unknown1,
                                            sendValue,
                                            streamSoundExtension,
                                            prefetchFileIndex,
                                        }
                                    } else if (infoType == "Wave") {
                                        let waveIndexInWaveArchive = infoBuf.int(0x00, IntSize.U32, numMode)
                                        let unknown1 = infoBuf.int(0x04, IntSize.U32, numMode)
                                        let flagsRaw = infoBuf.int(0x08, IntSize.U32, numMode)
                                            let flags = {
                                                releasePriorityFix: null,
                                                channelPriority: null,
                                            }
                                            let flagsPointer = 0x0C
                                            if (flagsRaw & 0x1) {
                                                let arr = infoBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                                let padding = arr.slice(0, 2)
                                                flags.releasePriorityFix = arr[2], flags.channelPriority = arr[3]
                                            }
                                        infoData = {
                                            waveIndexInWaveArchive,
                                            unknown1,
                                            flags,
                                        }
                                    } else if (infoType == "Sequence") {
                                        let bankIdTableReference = bfsar_parseReference(infoBuf, numMode, 0x00, 0x0100, "Bank id table")
                                            let bankIdTable = bfsar_parseItemIdTable(infoBuf, numMode, bankIdTableReference.offsetRel, "Bank", "Sound info sequence")
                                        let validTrackBitmask = infoBuf.int(0x08, IntSize.U32, numMode)
                                        let flagsRaw = infoBuf.int(0x0C, IntSize.U32, numMode)
                                            let flags = {
                                                startOffset: null,
                                                releasePriorityFix: null,
                                                channelPriority: null,
                                            }
                                            let flagsPointer = 0x10
                                            if (flagsRaw & 0x1) flags.startOffset = infoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                            if (flagsRaw & 0x2) {
                                                let arr = infoBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                                let padding = arr.slice(0, 2)
                                                flags.releasePriorityFix = arr[2], flags.channelPriority = arr[3]
                                            }
                                        infoData = {
                                            bankIdTable,
                                            validTrackBitmask,
                                            flags,
                                        }
                                    }
                            let flagsRaw = soundInfoBuf.int(0x14, IntSize.U32, numMode)
                                let flags = {
                                    name: null,
                                    panCurve: null,
                                    panMode: null,
                                    actorPlayerId: null,
                                    playerPriority: null,
                                    info3D: null,
                                    isFrontBypass: null,
                                    userParam1: null,
                                    userParam2: null,
                                    userParam3: null,
                                    userParam4: null,
                                }
                                let flagsPointer = 0x18
                                if (flagsRaw & 0x1) {
                                    let stringTableIndex = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    flags.name = bfsar_stringTable[stringTableIndex]
                                }
                                if (flagsRaw & 0x2) {
                                    let arr = soundInfoBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    let padding = arr.slice(0, 2)
                                    flags.panCurve = arr[2], flags.panMode = arr[3]
                                }
                                if (flagsRaw & 0x4) {
                                    let arr = soundInfoBuf.arr(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    let padding = arr.slice(0, 2)
                                    flags.actorPlayerId = arr[2], flags.playerPriority = arr[3]
                                }
                                if (flagsRaw & 0x100) {
                                    let info3DOffset = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    let info3DBuf = soundInfoBuf.buf(info3DOffset, soundInfoBuf.data.byteLength - info3DOffset)
                                        flags.info3D = {}
                                        flags.info3D.flagsRaw = info3DBuf.int(0x00, IntSize.U32, numMode)
                                        flags.info3D.unknown1 = FileBuf.float_int(info3DBuf.int(0x04, IntSize.U32, numMode), FloatPrecision.SINGLE)
                                        flags.info3D.unknown2 = info3DBuf.int(0x08, IntSize.U8, numMode)
                                        flags.info3D.unknown3 = info3DBuf.int(0x09, IntSize.U8, numMode)
                                        let padding = info3DBuf.int(0x0A, IntSize.U16, numMode)
                                }
                                if (flagsRaw & 0x20000) flags.isFrontBypass = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                if (flagsRaw & 0x10000000) flags.userParam1 = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                if (flagsRaw & 0x20000000) flags.userParam2 = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                if (flagsRaw & 0x40000000) flags.userParam3 = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                                if (flagsRaw & 0x80000000) flags.userParam4 = soundInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                            soundInfos[i] = {
                                fileIndex,
                                playerFileIndex,
                                initialVolume,
                                remoteFilter,
                                infoType,
                                infoData,
                                flags,
                            }
                    }
            let soundGroupInfoTableReference = bfsar_parseReference(buf, numMode, 0x10, 0x2104, "Sound group info table")
                let soundGroupInfoTable = bfsar_parseReferenceTable(buf, numMode, soundGroupInfoTableReference.offsetRel + 0x08, 0x2204, "Sound group info")
                    let soundGroupInfos = new Array(soundGroupInfoTable.length)
                    for (let i = 0; i < soundGroupInfoTable.length; i++) {
                        let soundGroupInfoBufStart = soundGroupInfoTableReference.offsetRel + 0x08 + soundGroupInfoTable[i].offsetRel
                        let soundGroupInfoBuf = buf.buf(soundGroupInfoBufStart, buf.data.byteLength - soundGroupInfoBufStart)
                            let firstSoundItemId = bfsar_parseItemId(soundGroupInfoBuf, numMode, 0x00, "Sound", "Sound group info first sound")
                                let firstSoundFileIndex = firstSoundItemId.fileIndex
                            let lastSoundItemId = bfsar_parseItemId(soundGroupInfoBuf, numMode, 0x04, "Sound", "Sound group info last sound")
                                let lastSoundFileIndex = lastSoundItemId.fileIndex
                            let fileIndexTableReference = bfsar_parseReference(soundGroupInfoBuf, numMode, 0x08, 0x0100, "Sound group info file table")
                                let fileIndexTable = bfsar_parseIntTable(soundGroupInfoBuf, numMode, fileIndexTableReference.offsetRel, IntSize.U32)
                            let waveArchiveTableReferenceReference = bfsar_parseReference(soundGroupInfoBuf, numMode, 0x10, 0x2205, "Sound group info wave archive table reference")
                                let waveArchiveTable = null
                                if (waveArchiveTableReferenceReference.isPresent) {
                                    let waveArchiveTableReference = bfsar_parseReference(soundGroupInfoBuf, numMode, waveArchiveTableReferenceReference.offsetRel, 0x0100, "Sound group info wave archive table")
                                        let waveArchiveTableRaw = bfsar_parseItemIdTable(soundGroupInfoBuf, numMode, waveArchiveTableReferenceReference.offsetRel + waveArchiveTableReference.offsetRel, "Wave archive", "Sound group info wave archive")
                                            waveArchiveTable = new Array(waveArchiveTableRaw.length)
                                            for (let j = 0; j < waveArchiveTableRaw.length; j++) waveArchiveTable[j] = waveArchiveTableRaw[j].fileIndex
                                }
                            let flagsRaw = soundGroupInfoBuf.int(0x18, IntSize.U32, numMode)
                                let flags = {
                                    name: null,
                                }
                                let flagsPointer = 0x1C
                                if (flagsRaw & 0x1) {
                                    let stringTableIndex = soundGroupInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    flags.name = bfsar_stringTable[stringTableIndex]
                                }
                            soundGroupInfos[i] = {
                                firstSoundFileIndex,
                                lastSoundFileIndex,
                                fileIndexTable,
                                waveArchiveTable,
                                flags,
                            }
                    }
            let bankInfoTableReference = bfsar_parseReference(buf, numMode, 0x18, 0x2101, "Bank info table")
                let bankInfoTable = bfsar_parseReferenceTable(buf, numMode, bankInfoTableReference.offsetRel + 0x08, 0x2206, "Bank info")
                    let bankInfos = new Array(bankInfoTable.length)
                    for (let i = 0; i < bankInfoTable.length; i++) {
                        let bankInfoBufStart = bankInfoTableReference.offsetRel + 0x08 + bankInfoTable[i].offsetRel
                        let bankInfoBuf = buf.buf(bankInfoBufStart, buf.data.byteLength - bankInfoBufStart)
                            let fileIndex = bankInfoBuf.int(0x00, IntSize.U32, numMode)
                            let waveArchiveTableReference = bfsar_parseReference(bankInfoBuf, numMode, 0x04, 0x0100, "Bank info wave archive table")
                                let waveArchiveTableRaw = bfsar_parseItemIdTable(bankInfoBuf, numMode, waveArchiveTableReference.offsetRel, "Wave archive", "Bank info wave archive")
                                    let waveArchiveTable = new Array(waveArchiveTableRaw.length)
                                    for (let j = 0; j < waveArchiveTableRaw.length; j++) waveArchiveTable[j] = waveArchiveTableRaw[j].fileIndex
                            let flagsRaw = bankInfoBuf.int(0x0C, IntSize.U32, numMode)
                                let flags = {
                                    name: null,
                                }
                                let flagsPointer = 0x10
                                if (flagsRaw & 0x1) {
                                    let stringTableIndex = bankInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    flags.name = bfsar_stringTable[stringTableIndex]
                                }
                        bankInfos[i] = {
                            fileIndex,
                            waveArchiveTable,
                            flags,
                        }
                    }
            let waveArchiveInfoTableReference = bfsar_parseReference(buf, numMode, 0x20, 0x2103, "Wave archive info table")
                let waveArchiveInfoTable = bfsar_parseReferenceTable(buf, numMode, waveArchiveInfoTableReference.offsetRel + 0x08, 0x2207, "Wave archive info")
                    let waveArchiveInfos = new Array(waveArchiveInfoTable.length)
                    for (let i = 0; i < waveArchiveInfoTable.length; i++) {
                        let waveArchiveInfoBufStart = waveArchiveInfoTableReference.offsetRel + 0x08 + waveArchiveInfoTable[i].offsetRel
                        let waveArchiveInfoBuf = buf.buf(waveArchiveInfoBufStart, buf.data.byteLength - waveArchiveInfoBufStart)
                            let fileIndex = waveArchiveInfoBuf.int(0x00, IntSize.U32, numMode)
                            let unknown1 = waveArchiveInfoBuf.int(0x04, IntSize.U8, numMode)
                            let padding = waveArchiveInfoBuf.int(0x05, IntSize.U24, numMode)
                            let flagsRaw = waveArchiveInfoBuf.int(0x08, IntSize.U32, numMode)
                                let flags = {
                                    name: null,
                                    numWaveFiles: null,
                                }
                                let flagsPointer = 0x0C
                                if (flagsRaw & 0x1) {
                                    let stringTableIndex = waveArchiveInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    flags.name = bfsar_stringTable[stringTableIndex]
                                }
                                if (flagsRaw & 0x2) flags.numWaveFiles = waveArchiveInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                        waveArchiveInfos[i] = {
                            fileIndex,
                            unknown1,
                            flags,
                        }
                    }
            let groupInfoTableReference = bfsar_parseReference(buf, numMode, 0x28, 0x2105, "Group info table")
                let groupInfoTable = bfsar_parseReferenceTable(buf, numMode, groupInfoTableReference.offsetRel + 0x08, 0x2208, "Group info")
                    let groupInfos = new Array(groupInfoTable.length)
                    for (let i = 0; i < groupInfoTable.length; i++) {
                        let groupInfoBufStart = groupInfoTableReference.offsetRel + 0x08 + groupInfoTable[i].offsetRel
                        let groupInfoBuf = buf.buf(groupInfoBufStart, buf.data.byteLength - groupInfoBufStart)
                            let fileIndex = groupInfoBuf.int(0x00, IntSize.U32, numMode)
                                if (fileIndex == 0xFFFFFFFF) fileIndex = null
                                let isExternal = fileIndex == null
                            let flagsRaw = groupInfoBuf.int(0x04, IntSize.U32, numMode)
                                let flags = {
                                    name: null,
                                }
                                let flagsPointer = 0x08
                                if (flagsRaw & 0x1) {
                                    let stringTableIndex = groupInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    flags.name = bfsar_stringTable[stringTableIndex]
                                }
                        groupInfos[i] = {
                            fileIndex,
                            isExternal,
                            flags,
                        }
                    }
            let playerInfoTableReference = bfsar_parseReference(buf, numMode, 0x30, 0x2102, "Player info table")
                let playerInfoTable = bfsar_parseReferenceTable(buf, numMode, playerInfoTableReference.offsetRel + 0x08, 0x2209, "Player info")
                    let playerInfos = new Array(playerInfoTable.length)
                    for (let i = 0; i < playerInfoTable.length; i++) {
                        let playerInfoBufStart = playerInfoTableReference.offsetRel + 0x08 + playerInfoTable[i].offsetRel
                        let playerInfoBuf = buf.buf(playerInfoBufStart, buf.data.byteLength - playerInfoBufStart)
                            let playableSoundLimit = playerInfoBuf.int(0x00, IntSize.U32, numMode)
                            let flagsRaw = playerInfoBuf.int(0x04, IntSize.U32, numMode)
                                let flags = {
                                    name: null,
                                    playerHeapSize: null,
                                }
                                let flagsPointer = 0x08
                                if (flagsRaw & 0x1) {
                                    let stringTableIndex = playerInfoBuf.int(flagsPointer, IntSize.U32, numMode); flagsPointer += 0x04
                                    flags.name = bfsar_stringTable[stringTableIndex]
                                }
                                if (flagsRaw & 0x2) flags.playerHeapSize = playerInfoBuf.int(flagsPointer, IntSize.U32, numMode), flagsPointer += 0x04
                        playerInfos[i] = {
                            playableSoundLimit,
                            flags,
                        }
                    }
            let fileInfoTableReference = bfsar_parseReference(buf, numMode, 0x38, 0x2106, "File info table")
                let fileInfoTable = bfsar_parseReferenceTable(buf, numMode, fileInfoTableReference.offsetRel + 0x08, 0x220A, "File info")
                    let fileInfos = new Array(fileInfoTable.length)
                    for (let i = 0; i < fileInfoTable.length; i++) {
                        let fileInfoBufStart = fileInfoTableReference.offsetRel + 0x08 + fileInfoTable[i].offsetRel
                        let fileInfoBuf = buf.buf(fileInfoBufStart, buf.data.byteLength - fileInfoBufStart)
                            let fileReference = bfsar_parseReference(fileInfoBuf, numMode, 0x00, [0x220C, 0x220D], "File")
                                let infoBuf = fileInfoBuf.buf(fileReference.offsetRel, fileInfoBuf.data.byteLength - fileReference.offsetRel)
                                let fileType = null
                                if (fileReference.id == 0x220C) fileType = "Internal"
                                else if (fileReference.id == 0x220D) fileType = "External"
                                let fileData = null
                                if (fileType == "Internal") {
                                    let fileBlockReference = bfsar_parseReference(infoBuf, numMode, 0x00, 0x1F00, "File data")
                                        let isInGroupFile = !fileBlockReference.isPresent, fileBlockOffset = fileBlockReference.offsetRel
                                    let fileSize = infoBuf.int(0x08, IntSize.U32, numMode)
                                        if (fileSize == 0xFFFFFFFF) fileSize = null
                                    let groupTableReference = bfsar_parseReference(infoBuf, numMode, 0x0C, 0x0100, "File group table")
                                        let groupTableRaw = bfsar_parseItemIdTable(infoBuf, numMode, groupTableReference.offsetRel, "Group", "File group")
                                            let groupTable = new Array(groupTableRaw.length)
                                            for (let j = 0; j < groupTableRaw.length; j++) groupTable[j] = groupTableRaw[j].fileIndex
                                    let content = null
                                        if (!isInGroupFile) content = {
                                            fileBlockOffset,
                                            fileSize,
                                        }
                                    fileData = {
                                        isInGroupFile,
                                        groupTable,
                                        content,
                                    }
                                } else if (fileType == "External") {
                                    let nullIndex = infoBuf.arr(0x00, infoBuf.data.byteLength).indexOf(0x00)
                                    let name = infoBuf.str(0x00, nullIndex)
                                    fileData = {
                                        name,
                                    }
                                }
                        fileInfos[i] = {
                            fileType,
                            fileData,
                        }
                    }
            let mainInfoReference = bfsar_parseReference(buf, numMode, 0x40, 0x220B, "Sound archive player info table")
                let mainInfoBuf = buf.buf(mainInfoReference.offsetRel + 0x08, buf.data.byteLength - (mainInfoReference.offsetRel + 0x08))
                    let mainInfo = {
                        numSequenceSounds: mainInfoBuf.int(0x00, IntSize.U16, numMode),
                        numSequenceTracks: mainInfoBuf.int(0x02, IntSize.U16, numMode),
                        numStreamSounds: mainInfoBuf.int(0x04, IntSize.U16, numMode),
                        unknown1: mainInfoBuf.int(0x06, IntSize.U16, numMode),
                        numStreamChannels: mainInfoBuf.int(0x08, IntSize.U16, numMode),
                        numWaveSounds: mainInfoBuf.int(0x0A, IntSize.U16, numMode),
                        unknown2: mainInfoBuf.int(0x0C, IntSize.U16, numMode),
                        streamBufferTimes: mainInfoBuf.int(0x0E, IntSize.U8, numMode),
                        areWavesAdvanced: mainInfoBuf.int(0x0F, IntSize.U8, numMode) != 0,
                    }

            bfsar_fileInfoData = {
                soundInfos,
                soundGroupInfos,
                bankInfos,
                waveArchiveInfos,
                groupInfos,
                playerInfos,
                fileInfos,
                mainInfo,
            }
        } else if (id == 0x2002 && idStr == "FILE") {
            for (let i = 0; i < bfsar_fileInfoData.fileInfos.length; i++) {
                let fileInfo = bfsar_fileInfoData.fileInfos[i]
                if (fileInfo.fileType == "Internal" && !fileInfo.fileData.isInGroupFile) {
                    let content = buf.buf(fileInfo.fileData.content.fileBlockOffset + 0x08, fileInfo.fileData.content.fileSize)
                    bfsar_fileInfoData.fileInfos[i].fileData.content = content.data
                }
            }
        } else FileBuf.expectVal(0, 1, `Unknown or unmatching block id "0x${id.toString(16).padStart(4, "0").toUpperCase()}" and block id string "${idStr}"`)
}
function bfsar_parseReference (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let id = fileBuf.int(offset, IntSize.U16, numMode)
    let padding = fileBuf.int(offset + 0x02, IntSize.U16, numMode)
    let offsetRel = fileBuf.int(offset + 0x04, IntSize.U32, numMode)

    let isPresent = id != 0x0000 || offsetRel != 0xFFFFFFFF
        if (!isPresent) id = null, offsetRel = null
    if (isPresent && expectedId != null) FileBuf.expectVal(id, expectedId, `Invalid reference: ${expectedIdMsg == null ? `<generic>` : expectedIdMsg}`)
    return {id, offsetRel, isPresent}
}
function bfsar_parseItemId (fileBuf, numMode, offset, expectedFileType = null, expectedFileTypeMsg = null) {
    let arr = fileBuf.arr(offset, 0x04, numMode)
    let fileType = arr[0], fileIndex = (arr[1] << 16) + (arr[2] << 8) + arr[3]

    let isPresent = fileType != 0xFF || fileIndex != 0xFFFFFF
        if (!isPresent) fileType = null, fileIndex = null
    if (isPresent && expectedFileType != null) FileBuf.expectVal(bfsar_fileTypes[fileType], expectedFileType, `Invalid item id: ${expectedFileTypeMsg == null ? `<generic>` : expectedFileTypeMsg}`)
    return {fileType, fileIndex, isPresent}
}
function bfsar_parseIntTable (fileBuf, numMode, offset, entrySize) {
    let numEntries = fileBuf.int(offset, IntSize.U32, numMode)
        let entries = new Array(numEntries)
        for (let i = 0; i < numEntries; i++) entries[i] = fileBuf.int(offset + 0x04 + (i * entrySize), entrySize, numMode)
    return entries
}
function bfsar_parseReferenceTable (fileBuf, numMode, offset, expectedId = null, expectedIdMsg = null) {
    let numReferences = fileBuf.int(offset, IntSize.U32, numMode)
        let references = new Array(numReferences)
        for (let i = 0; i < numReferences; i++) references[i] = bfsar_parseReference(fileBuf, numMode, offset + 0x04 + (i * 0x08), expectedId, expectedIdMsg)
    return references
}
function bfsar_parseItemIdTable (fileBuf, numMode, offset, expectedFileType = null, expectedFileTypeMsg = null) {
    let numItemIds = fileBuf.int(offset, IntSize.U32, numMode)
        let itemIds = new Array(numItemIds)
        for (let i = 0; i < numItemIds; i++) itemIds[i] = bfsar_parseItemId(fileBuf, numMode, offset + 0x04 + (i * 0x04), expectedFileType, expectedFileTypeMsg)
    return itemIds
}
function bfsar_getJsonBuf (obj) {
    return new TextEncoder().encode(JSON.stringify(obj, null, 4) + "\n").buffer
}
