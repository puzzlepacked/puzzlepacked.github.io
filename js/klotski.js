let debugMode = false
// var vConsole = new window.VConsole();
const LEFT = 1
const RIGHT = 2
const TOP = 3
const BOTTOM = 4
const HORIZONTAL = 10
const VERTICAL = 11

class KlotskiBlock {
    constructor(id, colIndex, rowIndex, cols, rows, character) {
        this.id = id
        this.colIndex = colIndex
        this.rowIndex = rowIndex
        this.cols = cols
        this.rows = rows
        this.character = character
    }
}

class RectF {
    constructor(l, t, r, b) {
        this.left = l
        this.top = t
        this.right = r
        this.bottom = b
    }

    width() {
        return this.right - this.left
    }

    height() {
        return this.bottom - this.top
    }

    contains(x, y) {
        return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom
    }

    setRect(rect) {
        this.left = rect.left
        this.right = rect.right
        this.top = rect.top
        this.bottom = rect.bottom
    }

    centerX() {
        return this.left + (this.right - this.left) / 2.0
    }

    centerY() {
        return this.top + (this.bottom - this.top) / 2.0
    }

    offset(x, y) {
        this.left += x
        this.right += x
        this.top += y
        this.bottom += y
    }
}

class MoveLimitContext {
    constructor(movingPosition, moveLimitMinX, moveLimitMinY, moveLimitMaxX, moveLimitMaxY) {
        this.movingPosition = movingPosition
        this.moveLimitMinX = moveLimitMinX
        this.moveLimitMinY = moveLimitMinY
        this.moveLimitMaxX = moveLimitMaxX
        this.moveLimitMaxY = moveLimitMaxY
    }
}

class KlotskiBoard {
    constructor(levelId, blocks) {
        this.levelId = levelId
        this.blocks = blocks
        this.boardWidth = 4
        this.boardHeight = 5
        this.steps = 0
        this.time = 0
        this.boardGrid = []
        this.blockMap = new Map()
        this.layoutContext = null
        this.tempPositions = new Map()
        for (let rowIndex = 0; rowIndex < this.boardHeight; rowIndex++) {
            let row = []
            for (let colIndex = 0; colIndex < this.boardWidth; colIndex++) {
                row[colIndex] = -1
            }
            this.boardGrid[rowIndex] = row
        }
        for (const i in blocks) {
            let block = blocks[i]
            this.blockMap.set(block.id, block)
            this.fillGrid(block, true)
        }
    }

    matchBoard(canvasWidth, canvasHeight, padding, spacing, bottomUsed,topUsed) {
        let spaceWidth = canvasWidth - padding * 2
        let spaceHeight = canvasHeight - bottomUsed - topUsed - spacing - padding * 2
        let maxGridWidth = (spaceWidth - (this.boardWidth - 1) * spacing) / this.boardWidth
        let maxGridHeight = (spaceHeight - (this.boardHeight - 1) * spacing) / this.boardHeight
        let gridSize = Math.min(maxGridWidth, maxGridHeight)
        let boardCanvasWidth = this.boardWidth * gridSize + (this.boardWidth - 1) * spacing
        let boardCanvasHeight = this.boardHeight * gridSize + (this.boardHeight - 1) * spacing
        let offsetX = (spaceWidth - boardCanvasWidth) / 2 + padding
        let offsetY = (spaceHeight - boardCanvasHeight) / 2 + padding + topUsed
        let boardCanvasBounds = new RectF(offsetX, offsetY, offsetX + boardCanvasWidth, offsetY + boardCanvasHeight)
        this.layoutContext = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            padding: padding,
            spacing: spacing,
            bottomUsed: bottomUsed,
            boardCanvasWidth: boardCanvasWidth,
            gridSize: gridSize,
            offsetX: offsetX,
            offsetY: offsetY,
            boardCanvasBounds: boardCanvasBounds
        }

        for (let i in this.blocks) {
            this.updateBlockPosition(this.blocks[i])
        }
    }

    getPosition(block) {
        return this.tempPositions.get(block.id)
    }

    move(block, targetRowIndex, targetColIndex) {
        this.fillGrid(block, false)
        block.colIndex = targetColIndex
        block.rowIndex = targetRowIndex
        this.fillGrid(block, true)
    }

    isPassLevel() {
        for (const i in this.blocks) {
            let block = this.blocks[i]
            if (block.character) {
                return block.colIndex === 1 && block.rowIndex === 3
            }
        }
        throw "illegal args"
    }

    getStepCount(diff) {
        return Math.round(Math.abs(diff) / (this.layoutContext.gridSize + this.layoutContext.spacing))
    }

    arrayContain(array, item) {
        for (let i in array) {
            if (array[i] === item) {
                return true
            }
        }
        return false;
    }

    getMoveAbleMultiStepCount(blocks, direction, moveContexts, allowMoveMultiBlock) {
        if (blocks.length === 0) {
            return 0
        }
        let minStep = -1
        for (const i in blocks) {
            let id = blocks[i]
            let block = this.blockMap.get(id)
            let stepCount = this.getMoveAbleSingleStepCount(block, direction)
            if (stepCount === 0 && allowMoveMultiBlock) {
                let nextBlocks = []
                switch (direction) {
                    case LEFT:
                    case RIGHT: {
                        let targetColIndex = direction === RIGHT ? (block.colIndex + block.cols) : (block.colIndex - 1)
                        if (targetColIndex >= 0 && targetColIndex < this.boardWidth) {
                            for (let rowIndex = block.rowIndex; rowIndex < block.rowIndex + block.rows; rowIndex++) {
                                let tid = this.boardGrid[rowIndex][targetColIndex]
                                if (tid !== -1 && !this.arrayContain(nextBlocks, tid)) {
                                    nextBlocks.push(tid)
                                }
                            }
                        }
                        break
                    }

                    case TOP:
                    case BOTTOM: {
                        let targetRowIndex = direction === BOTTOM ? (block.rowIndex + block.rows) : (block.rowIndex - 1)
                        if (targetRowIndex >= 0 && targetRowIndex < this.boardHeight) {
                            for (let colIndex = block.colIndex; colIndex < block.colIndex + block.cols; colIndex++) {
                                let tid = this.boardGrid[targetRowIndex][colIndex]
                                if (tid !== -1 && !this.arrayContain(nextBlocks, tid)) {
                                    nextBlocks.push(tid)
                                }
                            }
                        }
                        break
                    }
                }
                stepCount = this.getMoveAbleMultiStepCount(nextBlocks, direction, moveContexts, allowMoveMultiBlock)
            }

            if (minStep === -1) {
                minStep = stepCount
            } else {
                minStep = Math.min(minStep, stepCount)
            }
        }
        let step = minStep === -1 ? 0 : minStep
        for (const i in blocks) {
            let blockId = blocks[i]
            let block = this.blockMap.get(blockId)
            moveContexts.set(block.id, step)
        }
        return step
    }

    getMoveAbleSingleStepCount(block, direction) {
        let stepCount = 0
        switch (direction) {
            case LEFT: {
                for (let col = block.colIndex - 1; col >= 0; col--) {
                    let allow = true
                    for (let row = block.rowIndex; row < block.rowIndex + block.rows; row++) {
                        let id = this.boardGrid[row][col]
                        if (id !== -1 && id !== block.id) {
                            allow = false
                            break
                        }
                    }
                    if (allow) {
                        stepCount++
                    } else {
                        break
                    }
                }
                break
            }
            case RIGHT: {
                for (let col = block.colIndex + block.cols; col < this.boardWidth; col++) {
                    let allow = true
                    for (let row = block.rowIndex; row < block.rowIndex + block.rows; row++) {
                        let id = this.boardGrid[row][col]
                        if (id !== -1 && id !== block.id) {
                            allow = false
                            break
                        }
                    }
                    if (allow) {
                        stepCount++
                    } else {
                        break
                    }
                }
                break
            }
            case TOP: {
                for (let row = block.rowIndex - 1; row >= 0; row--) {
                    let allow = true
                    for (let col = block.colIndex; col < block.colIndex + block.cols; col++) {
                        let id = this.boardGrid[row][col]
                        if (id !== -1 && id !== block.id) {
                            allow = false
                            break
                        }
                    }
                    if (allow) {
                        stepCount++
                    } else {
                        break
                    }
                }
                break
            }
            case BOTTOM: {
                for (let row = block.rowIndex + block.rows; row < this.boardHeight; row++) {
                    let allow = true
                    for (let col = block.colIndex; col < block.colIndex + block.cols; col++) {
                        let id = this.boardGrid[row][col]
                        if (id !== -1 && id !== block.id) {
                            allow = false
                            break
                        }
                    }
                    if (allow) {
                        stepCount++
                    } else {
                        break
                    }
                }
                break
            }
        }
        return stepCount;
    }

    moveLimit(block, moveLimitContexts, moveDirection, allowMoveMultiBlock = true) {
        moveLimitContexts.clear()
        let moveContexts = new Map()
        if (moveDirection === HORIZONTAL) {
            this.getMoveAbleMultiStepCount([block.id], LEFT, moveContexts, allowMoveMultiBlock)
            this.moveLimitInner(moveContexts, moveLimitContexts, function (context, offset) {
                context.moveLimitMinX -= offset
            })
            moveContexts.clear()
            this.getMoveAbleMultiStepCount([block.id], RIGHT, moveContexts, allowMoveMultiBlock)
            this.moveLimitInner(moveContexts, moveLimitContexts, function (context, offset) {
                context.moveLimitMaxX += offset
            })
            moveContexts.clear()
        } else {
            this.getMoveAbleMultiStepCount([block.id], TOP, moveContexts, allowMoveMultiBlock)
            this.moveLimitInner(moveContexts, moveLimitContexts, function (context, offset) {
                context.moveLimitMinY -= offset
            })
            moveContexts.clear()
            this.getMoveAbleMultiStepCount([block.id], BOTTOM, moveContexts, allowMoveMultiBlock)
            this.moveLimitInner(moveContexts, moveLimitContexts, function (context, offset) {
                context.moveLimitMaxY += offset
            })
            moveContexts.clear()
        }
    }

    moveLimitInner(moveContexts, moveLimitContexts, opFunc) {
        for (const [key, value] of moveContexts) {
            if (value !== 0) {
                let targetBlock = this.blockMap.get(key)
                let context = moveLimitContexts.get(targetBlock.id)
                if (context == null) {
                    let position = this.getPosition(targetBlock)
                    context = new MoveLimitContext(new RectF(position.left, position.top, position.right, position.bottom), 0, 0, 0, 0)
                }
                opFunc(context, value * this.layoutContext.gridSize + value * this.layoutContext.spacing)
                moveLimitContexts.set(targetBlock.id, context)
            }
        }
    }

    fillGrid(block, fill = true) {
        for (let c = block.colIndex; c < block.colIndex + block.cols; c++) {
            for (let r = block.rowIndex; r < block.rowIndex + block.rows; r++) {
                this.boardGrid[r][c] = fill ? block.id : -1
            }
        }

        if (fill && this.layoutContext != null) {
            this.updateBlockPosition(block);
        }
    }

    updateBlockPosition(block) {
        this.tempPositions.set(block.id, this.getBlockRect(block.colIndex, block.rowIndex, block.cols, block.rows))
    }

    getBlockRect(colIndex, rowIndex, cols, rows) {
        let layoutContext = this.layoutContext
        let x = layoutContext.offsetX + colIndex * layoutContext.gridSize + colIndex * layoutContext.spacing
        let y = layoutContext.offsetY + rowIndex * layoutContext.gridSize + rowIndex * layoutContext.spacing
        let width = layoutContext.gridSize * cols + (cols - 1) * layoutContext.spacing
        let height = layoutContext.gridSize * rows + (rows - 1) * layoutContext.spacing
        return new RectF(x, y, x + width, y + height)
    }
}

// document.body.style.overflow = 'hidden'
let image1x1 = new Image()
image1x1.src = "images/theme_0_klo_1.png";
let image1x2 = new Image()
image1x2.src = "images/theme_0_klo_2.png";
let image2x1 = new Image()
image2x1.src = "images/theme_0_klo_3.png";
let image2x2 = new Image()
image2x2.src = "images/theme_0_klo_0.png"
let imageExit = new Image()
imageExit.src = "images/game_arrow_out_white.png"

function createKlotSkiGameWithRandom(cvs,onPass) {
    let blocks = []
    blocks.push(new KlotskiBlock(1, 0, 0, 1, 2, false))
    blocks.push(new KlotskiBlock(2, 1, 0, 1, 2, false))
    blocks.push(new KlotskiBlock(3, 3, 0, 1, 2, false))
    blocks.push(new KlotskiBlock(4, 0, 2, 1, 2, false))
    blocks.push(new KlotskiBlock(5, 1, 2, 1, 2, false))
    blocks.push(new KlotskiBlock(6, 2, 2, 2, 2, true))
    blocks.push(new KlotskiBlock(7, 0, 4, 1, 1, false))
    blocks.push(new KlotskiBlock(8, 1, 4, 1, 1, false))
    blocks.push(new KlotskiBlock(9, 2, 4, 1, 1, false))
    blocks.push(new KlotskiBlock(10, 3, 4, 1, 1, false))
    let board = new KlotskiBoard(1, blocks)
    createKlotskiGame(board,cvs,onPass)
}

function createKlotskiGame(board, cvs, onPass) {
    let ctx = cvs.getContext("2d")

    let ratio = window.devicePixelRatio || 1;
    cvs.width = cvs.clientWidth * ratio; // 实际渲染像素
    cvs.height = cvs.clientHeight * ratio; // 实际渲染像素
    cvs.style.width = `${cvs.clientWidth}px`; // 控制显示大小
    cvs.style.height = `${cvs.clientHeight}px`; // 控制显示大小
    // setTransform() 允许您缩放、旋转、移动并倾斜当前的环境
    cvs.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    // cvs.setAttribute("height", cvs.clientHeight.toString())
    // cvs.setAttribute("width", cvs.clientWidth.toString())
    let game = {
        padding: 20,
        spacing: 10,
        exitSize: 50,
        exitSpacing: 20,
        inited: false,
        draggingContext: new Map(),
        draggingBlock: null,
        touchingBeginPosition: null,
        draggingDirection: null,
        isShowingTips:true,
        localXY: function (event) {
            if (event.touches == null) {
                return {
                    x: event.pageX - cvs.offsetLeft,
                    y: event.pageY - cvs.offsetTop
                }
            } else {
                return {
                    x: event.touches[0].pageX - cvs.offsetLeft,
                    y: event.touches[0].pageY - cvs.offsetTop
                }
            }
        },
        touchStart: function (event) {
            if (board == null) {
                return
            }
            if (board.isPassLevel()) {
                return
            }
            if (game.isShowingTips){
                game.isShowingTips = false
            }
            let xy = game.localXY(event)
            for (const blockIndex in board.blocks) {
                let block = board.blocks[blockIndex]
                let rect = board.getPosition(block)
                if (rect.contains(xy.x, xy.y)) {
                    game.draggingBlock = block
                    game.touchingBeginPosition = xy
                    game.draggingDirection = null
                    return;
                }
            }
            game.draggingBlock = null
            this.touchingBeginPosition = null
            game.draggingDirection = null
        },
        touchMove: function (event) {
            if (board == null || game.draggingBlock == null) {
                return
            }
            let xy = game.localXY(event)
            let diffX = xy.x - game.touchingBeginPosition.x
            let diffY = xy.y - game.touchingBeginPosition.y
            if (game.draggingDirection == null) {
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    if (Math.abs(diffX) < 10) {
                        return;
                    }
                    game.draggingDirection = HORIZONTAL
                } else {
                    if (Math.abs(diffY) < 10) {
                        return;
                    }
                    game.draggingDirection = VERTICAL
                }

                board.moveLimit(game.draggingBlock, game.draggingContext, game.draggingDirection)
            }

            for (let [key, value] of game.draggingContext) {
                let moveLimitContext = value
                let draggingStartPosition = board.getPosition(board.blockMap.get(key))
                let itemDiffX = game.clamp(diffX, moveLimitContext.moveLimitMinX, moveLimitContext.moveLimitMaxX)
                let itemDiffY = game.clamp(diffY, moveLimitContext.moveLimitMinY, moveLimitContext.moveLimitMaxY)
                moveLimitContext.movingPosition.setRect(draggingStartPosition)
                moveLimitContext.movingPosition.offset(itemDiffX, itemDiffY)
            }
        },
        touchEnd: function (event) {
            try {
                if (board == null || game.draggingBlock == null) {
                    return
                }
                let moved = false
                for (let [key, value] of game.draggingContext) {
                    board.fillGrid(board.blockMap.get(key), false)
                }

                for (let [key, value] of game.draggingContext) {
                    let item = board.blockMap.get(key)
                    let draggingPosition = value.movingPosition
                    let draggingStartPosition = board.getPosition(item)
                    let diffX = draggingPosition.left - draggingStartPosition.left
                    let diffY = draggingPosition.top - draggingStartPosition.top
                    let directionX = diffX < 0 ? -1 : 1
                    let directionY = diffY < 0 ? -1 : 1
                    let fromRowIndex = item.rowIndex
                    let fromColIndex = item.colIndex
                    let targetRowIndex = item.rowIndex + directionY * board.getStepCount(diffY)
                    let targetColIndex = item.colIndex + directionX * board.getStepCount(diffX)
                    let itemMoved = targetRowIndex !== fromRowIndex || targetColIndex !== fromColIndex
                    item.rowIndex = targetRowIndex
                    item.colIndex = targetColIndex

                    if (itemMoved) {
                        moved = true
                    }
                }

                for (let [key, value] of game.draggingContext) {
                    board.fillGrid(board.blockMap.get(key), true)
                }

                if (moved) {
                    if (board.isPassLevel()) {
                        console.log("恭喜过关")
                        if (onPass != null){
                            onPass()
                        }
                    }
                }
            } finally {
                game.draggingBlock = null
                game.touchingBeginPosition = null
                game.draggingDirection = null
                game.draggingContext.clear()
            }
        },
        clamp: function (target, minInclude, maxInclude) {
            if (target < minInclude) {
                return minInclude
            } else if (target > maxInclude) {
                return maxInclude
            } else {
                return target
            }
        },
        onSizeChanged: function (width, height) {
            let scaleFactor = 1
            board.matchBoard(width * scaleFactor, height * scaleFactor, this.padding * scaleFactor, this.spacing * scaleFactor, (this.exitSize + this.exitSpacing) * scaleFactor, 120 * scaleFactor)
            // ctx.scale(0.5,0.5)
            game.initGame()
        },
        initGame: function () {
            if (game.inited) {
                return
            }
            game.inited = true
            cvs.addEventListener("mousedown", this.touchStart)
            cvs.addEventListener("mousemove", this.touchMove)
            cvs.addEventListener("mouseup", this.touchEnd)
            cvs.addEventListener("mouseleave", this.touchEnd)
            cvs.addEventListener("touchstart", this.touchStart)
            cvs.addEventListener("touchmove", this.touchMove)
            cvs.addEventListener("touchend", this.touchEnd)
            cvs.addEventListener("touchcancel", this.touchEnd)

            setInterval(function () {
                ctx.clearRect(0, 0, cvs.clientWidth, cvs.clientHeight)

                ctx.fillStyle = "#FFFFFF"
                ctx.textBaseline = "top"
                ctx.textBaseline = "middle"
                let title = "FLOW SLIDER"
                ctx.font="2rem Arial"
                let titleTextWidth = ctx.measureText(title).width
                ctx.fillText(title,board.layoutContext.boardCanvasBounds.centerX() - titleTextWidth/2.0,board.layoutContext.boardCanvasBounds.top * 2.0 / 3.0)

                // ctx.fillText(title,0,10)
                let characterPos;
                for (const blockIndex in board.blocks) {
                    let block = board.blocks[blockIndex]
                    let img
                    if (block.cols === 2 && block.rows === 2) {
                        img = image2x2
                        ctx.fillStyle = "#E83931"
                    } else if (block.cols === 1 && block.rows === 2) {
                        img = image1x2
                        ctx.fillStyle = "#6DEA0F"
                    } else if (block.cols === 2 && block.rows === 1) {
                        img = image2x1
                        ctx.fillStyle = "#FFEA0F"
                    } else if (block.cols === 1 && block.rows === 1) {
                        img = image1x1
                        ctx.fillStyle = "#6CDBFF"
                    } else {
                        throw "unknown color type:" + block.rows + "," + block.cols
                    }

                    let position
                    let moveLimitContext = game.draggingContext.get(block.id)
                    if (moveLimitContext != null) {
                        position = moveLimitContext.movingPosition
                    } else {
                        position = board.getPosition(block)
                    }
                    if (block.character){
                        characterPos = position
                    }
                    if (debugMode) {
                        ctx.fillStyle = "#222222"
                        ctx.fillRect(position.left, position.top, position.width(), position.height())
                    } else {
                        ctx.drawImage(img, position.left, position.top, position.width(), position.height())
                    }
                }

                if (game.isShowingTips){
                    let tips ="Attempt to move the red square to the exit!"
                    ctx.font="14px Arial"
                    let maxContainerWidth = board.layoutContext.boardCanvasWidth * 0.8
                    let containerPaddingHorizontal = 20
                    let containerPaddingVertical = 10
                    let containerMarginTop = 10
                    let lineSpacing = 4
                    let maxTextWidth = maxContainerWidth - containerPaddingHorizontal * 2
                    let expectTextWidth = ctx.measureText(tips).width
                    let containerWidth
                    if (expectTextWidth >= maxTextWidth){
                        containerWidth = maxContainerWidth
                    }else {
                        containerWidth = expectTextWidth + containerPaddingHorizontal * 2
                    }
                    let textWidth = containerWidth - containerPaddingHorizontal * 2
                    let lines = []
                    let words = tips.split(" ")
                    let line = ""
                    let lineHeight = 0
                    let textHeight = 0
                    for (let i = 0; i < words.length; i++) {
                        let word = words[i]
                        let tm = ctx.measureText(line + word)
                        if (tm.width <= textWidth){
                            if (line.length !== 0){
                                line += " "
                            }
                            line += word
                            lineHeight = Math.max(0,tm.actualBoundingBoxDescent + tm.actualBoundingBoxAscent)
                        }else {
                            lines.push(line)
                            line = word
                            textHeight += lineHeight
                            lineHeight = 0
                        }
                    }
                    if (line.length !== 0){
                        lines.push(line)
                        textHeight += lineHeight
                    }
                    textHeight += (lines.length - 1) * lineSpacing
                    let containerHeight = textHeight + containerPaddingVertical * 2

                    let containerCenterX = characterPos.centerX()
                    if (containerCenterX + containerWidth / 2.0 > board.layoutContext.boardCanvasBounds.right){
                        containerCenterX -= (containerCenterX + containerWidth / 2.0) - board.layoutContext.boardCanvasBounds.right
                    }else if (containerCenterX - containerWidth / 2.0 < board.layoutContext.boardCanvasBounds.left) {
                        containerCenterX += board.layoutContext.boardCanvasBounds.left - (containerCenterX - containerWidth / 2.0)
                    }
                    ctx.fillStyle = "#FFFFFF"
                    let tipsX = containerCenterX - containerWidth / 2.0
                    let tipsY = characterPos.bottom + containerMarginTop
                    ctx.shadowColor = "#777777"
                    ctx.shadowOffsetX = 1
                    ctx.shadowOffsetY = 1
                    ctx.shadowBlur = 3

                    let radius = 10
                    ctx.beginPath()
                    ctx.moveTo(tipsX + radius,tipsY)
                    ctx.lineTo(tipsX + containerWidth - radius,tipsY)
                    ctx.arcTo(tipsX + containerWidth,tipsY,tipsX + containerWidth,tipsY + radius,radius)
                    ctx.lineTo(tipsX + containerWidth, tipsY + containerHeight - radius)
                    ctx.arcTo(tipsX + containerWidth, tipsY + containerHeight,tipsX + containerWidth - radius,tipsY + containerHeight,radius)
                    ctx.lineTo(tipsX + radius, tipsY + containerHeight)
                    ctx.arcTo(tipsX,tipsY + containerHeight,tipsX,tipsY + containerHeight - radius,radius)
                    ctx.lineTo(tipsX,tipsY + radius)
                    ctx.arcTo(tipsX,tipsY,tipsX + radius,tipsY,radius)
                    ctx.closePath()
                    ctx.fill()


                    ctx.shadowColor = "none"
                    ctx.shadowOffsetX = 0
                    ctx.shadowOffsetY = 0
                    ctx.shadowBlur = 0
                    let indicatorCenterX = characterPos.centerX()
                    let indicatorBottomY = tipsY+5
                    let indicatorSize = 20
                    ctx.beginPath()
                    ctx.moveTo(indicatorCenterX - indicatorSize / 2.0,indicatorBottomY)
                    ctx.lineTo(indicatorCenterX,indicatorBottomY - indicatorSize * 0.6)
                    ctx.lineTo(indicatorCenterX + indicatorSize / 2.0,indicatorBottomY)
                    ctx.closePath()
                    ctx.fill()

                    ctx.fillStyle= "#000000"
                    ctx.textBaseline = "top"
                    let textX = tipsX + containerPaddingHorizontal
                    let textY = tipsY + containerPaddingVertical
                    for (let i = 0; i < lines.length; i++) {
                        let line = lines[i]
                        ctx.fillText(line,textX,textY)
                        textY += lineHeight + lineSpacing
                    }
                }

                if (!debugMode) {
                    ctx.fillStyle = "#FFFFFF"
                    let lineHeight = 14
                    ctx.fillRect(0, board.layoutContext.boardCanvasBounds.bottom + game.exitSpacing, board.layoutContext.offsetX + board.layoutContext.gridSize + game.spacing - lineHeight / 2.0, lineHeight)
                    ctx.beginPath()
                    ctx.arc(board.layoutContext.offsetX + board.layoutContext.gridSize + game.spacing - lineHeight / 2.0, board.layoutContext.boardCanvasBounds.bottom + game.exitSpacing + lineHeight / 2.0, lineHeight / 2.0, 0, 2 * Math.PI, true)
                    ctx.fill()

                    ctx.fillRect(cvs.clientWidth - board.layoutContext.offsetX - board.layoutContext.gridSize - game.spacing + lineHeight / 2.0, board.layoutContext.boardCanvasBounds.bottom + game.exitSpacing, board.layoutContext.offsetX + board.layoutContext.gridSize + game.spacing - lineHeight / 2.0, lineHeight)
                    ctx.beginPath()
                    ctx.arc(cvs.clientWidth - board.layoutContext.offsetX - board.layoutContext.gridSize - game.spacing + lineHeight / 2.0, board.layoutContext.boardCanvasBounds.bottom + game.exitSpacing + lineHeight / 2.0, lineHeight / 2.0, 0, 2 * Math.PI, true)
                    ctx.fill()
                    ctx.drawImage(imageExit, board.layoutContext.boardCanvasBounds.centerX() - game.exitSize / 2.0, board.layoutContext.boardCanvasBounds.bottom + game.exitSpacing, game.exitSize, game.exitSize)
                }
            }, 1000.0 / 60.0)
        }
    }

    const ros = new ResizeObserver(function () {
        console.log(">>>game size changed:" + cvs.clientWidth,cvs.clientHeight)
        game.onSizeChanged(cvs.clientWidth, cvs.clientHeight)
    })
    ros.observe(cvs)
    return game
}