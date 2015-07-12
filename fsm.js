/*
 Finite State Machine Designer (http://madebyevan.com/fsm/)
 License: MIT License (see below)

 Copyright (c) 2010 Evan Wallace

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

var SNAP_COLOR = "#fff82c";

function sign(x) { return (x >> 31) + (x > 0 ? 1 : 0); }

function Link(a, b) {
    this.nodeA = a;
    this.nodeB = b;
    this.text = '';
    this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line

    // make anchor point relative to the locations of nodeA and nodeB
    this.parallelPart = 0.5; // percentage from nodeA to nodeB
    this.perpendicularPart = 0; // pixels from line between nodeA and nodeB
}

Link.prototype.getAnchorPoint = function() {
    var dx = this.nodeB.x - this.nodeA.x;
    var dy = this.nodeB.y - this.nodeA.y;
    var scale = Math.sqrt(dx * dx + dy * dy);
    return {
        'x': this.nodeA.x + dx * this.parallelPart - dy * this.perpendicularPart / scale,
        'y': this.nodeA.y + dy * this.parallelPart + dx * this.perpendicularPart / scale
    };
};

Link.prototype.setAnchorPoint = function(x, y) {
    var dx = this.nodeB.x - this.nodeA.x;
    var dy = this.nodeB.y - this.nodeA.y;
    var scale = Math.sqrt(dx * dx + dy * dy);
    this.parallelPart = (dx * (x - this.nodeA.x) + dy * (y - this.nodeA.y)) / (scale * scale);
    this.perpendicularPart = (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;
    // snap to a straight line
    if(this.parallelPart > 0 && this.parallelPart < 1 && Math.abs(this.perpendicularPart) < snapToPadding) {
        this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
        this.perpendicularPart = 0;
    }
};

Link.prototype.getEndPointsAndCircle = function() {
    if(this.perpendicularPart == 0) {
        var midX = (this.nodeA.x + this.nodeB.x) / 2;
        var midY = (this.nodeA.y + this.nodeB.y) / 2;
        var start = this.nodeA.closestPointOnCircle(midX, midY);
        var end = this.nodeB.closestPointOnCircle(midX, midY);
        return {
            'hasCircle': false,
            'startX': start.x,
            'startY': start.y,
            'endX': end.x,
            'endY': end.y,
        };
    }
    var anchor = this.getAnchorPoint();
    var circle = circleFromThreePoints(this.nodeA.x, this.nodeA.y, this.nodeB.x, this.nodeB.y, anchor.x, anchor.y);
    var isReversed = (this.perpendicularPart > 0);
    var reverseScale = isReversed ? 1 : -1;
    var startAngle = Math.atan2(this.nodeA.y - circle.y, this.nodeA.x - circle.x) - reverseScale * this.radius / circle.radius;
    var endAngle = Math.atan2(this.nodeB.y - circle.y, this.nodeB.x - circle.x) + reverseScale * this.radius / circle.radius;
    var startX = circle.x + circle.radius * Math.cos(startAngle);
    var startY = circle.y + circle.radius * Math.sin(startAngle);
    var endX = circle.x + circle.radius * Math.cos(endAngle);
    var endY = circle.y + circle.radius * Math.sin(endAngle);
    return {
        'hasCircle': true,
        'startX': startX,
        'startY': startY,
        'endX': endX,
        'endY': endY,
        'startAngle': startAngle,
        'endAngle': endAngle,
        'circleX': circle.x,
        'circleY': circle.y,
        'circleRadius': circle.radius,
        'reverseScale': reverseScale,
        'isReversed': isReversed,
    };
};

Link.prototype.draw = function(c) {
    var stuff = this.getEndPointsAndCircle();
    // draw arc
    c.beginPath();
    if(stuff.hasCircle) {
        c.arc(stuff.circleX, stuff.circleY, stuff.circleRadius, stuff.startAngle, stuff.endAngle, stuff.isReversed);
    } else {
        c.moveTo(stuff.startX, stuff.startY);
        c.lineTo(stuff.endX, stuff.endY);
    }
    c.stroke();
    // draw the head of the arrow
    if(stuff.hasCircle) {
        drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle - stuff.reverseScale * (Math.PI / 2));
    } else {
        drawArrow(c, stuff.endX, stuff.endY, Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX));
    }
    // draw the text
    if(stuff.hasCircle) {
        var startAngle = stuff.startAngle;
        var endAngle = stuff.endAngle;
        if(endAngle < startAngle) {
            endAngle += Math.PI * 2;
        }
        var textAngle = (startAngle + endAngle) / 2 + stuff.isReversed * Math.PI;
        var textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
        var textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
        drawText(c, this.text, textX, textY, textAngle, selectedObject == this);
    } else {
        var textX = (stuff.startX + stuff.endX) / 2;
        var textY = (stuff.startY + stuff.endY) / 2;
        var textAngle = Math.atan2(stuff.endX - stuff.startX, stuff.startY - stuff.endY);
        drawText(c, this.text, textX, textY, textAngle + this.lineAngleAdjust, selectedObject == this);
    }
};

Link.prototype.containsPoint = function(x, y) {
    var stuff = this.getEndPointsAndCircle();
    if(stuff.hasCircle) {
        var dx = x - stuff.circleX;
        var dy = y - stuff.circleY;
        var distance = Math.sqrt(dx*dx + dy*dy) - stuff.circleRadius;
        if(Math.abs(distance) < hitTargetPadding) {
            var angle = Math.atan2(dy, dx);
            var startAngle = stuff.startAngle;
            var endAngle = stuff.endAngle;
            if(stuff.isReversed) {
                var temp = startAngle;
                startAngle = endAngle;
                endAngle = temp;
            }
            if(endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }
            if(angle < startAngle) {
                angle += Math.PI * 2;
            } else if(angle > endAngle) {
                angle -= Math.PI * 2;
            }
            return (angle > startAngle && angle < endAngle);
        }
    } else {
        var dx = stuff.endX - stuff.startX;
        var dy = stuff.endY - stuff.startY;
        var length = Math.sqrt(dx*dx + dy*dy);
        var percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
        var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
        return (percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding);
    }
    return false;
};

var CIRCLE_NODE_T       = 0,
    ACCEPT_STATE_NODE_T = 1,
    RECTANGLE_NODE_T     = 2,
    TRIANGLE_NODE_T     = 3,
    TEXT_NODE_T         = 4,
    MAX_NODE_T          = 5;

function Node(x, y) {
    this.x = x;
    this.y = y;
    this.mouseOffsetX = 0;
    this.mouseOffsetY = 0;
    this.nodeType = CIRCLE_NODE_T;
    this.text = '';
    this.radius = 30;
    this.width  = 60;
    this.height = 60;
}

Node.prototype.clone = function () {
    var clone = new Node(this.x, this.y);

    clone.nodeType = this.nodeType;
    clone.text = this.text;
    clone.radius = this.radius;
    clone.width = this.width;
    clone.height = this.height;

    return clone;
}

Node.prototype.rightSide = function () {
    return this.x + this.rightOffset();
}
Node.prototype.leftSide = function () {
    return this.x + this.leftOffset();
}
Node.prototype.rightOffset = function () {
    if (this.nodeType == TEXT_NODE_T || this.nodeType == RECTANGLE_NODE_T) {
        return this.width / 2.0;
    }
    return this.radius;
}
Node.prototype.leftOffset = function () {
    return -this.rightOffset();
}

Node.prototype.topSide = function () {
    return this.y + this.topOffset();
}
Node.prototype.bottomSide = function () {
    return this.y + this.bottomOffset();
}
Node.prototype.topOffset = function () {
    if (this.nodeType == TRIANGLE_NODE_T) {
        return -this.height * 0.6666;
    }
    return -this.bottomOffset();
}
Node.prototype.bottomOffset = function () {
    if (this.nodeType == TEXT_NODE_T || this.nodeType == RECTANGLE_NODE_T) {
        return this.height / 2.0;
    }
    if (this.nodeType == TRIANGLE_NODE_T) {
        return this.height * 0.3333;
    }
    return this.radius;
}

Node.prototype.updateTextWidth = function () {
    var c = canvas.getContext('2d');
    c.font = '20px "Times New Romain", serif';
    this.width = Math.max(5, c.measureText(this.text).width);
};

Node.prototype.setMouseStart = function(x, y) {
    this.mouseOffsetX = this.x - x;
    this.mouseOffsetY = this.y - y;
};

Node.prototype.setAnchorPoint = function(x, y) {
    this.x = x + this.mouseOffsetX;
    this.y = y + this.mouseOffsetY;
};

Node.prototype.setNewRadius = function (x,y) {
    var dx = this.x - x;
    var dy = this.y - y;
    var scale = Math.abs(1.0 + sign(dx) * sign(dy) * (Math.sqrt(dx * dx + dy * dy) / 100.0));
    this.radius = Math.max(5.0, 30 * scale);

    // maybe make changes to only one dimension at a time ?
    this.width  = Math.max(5.0, 60 * Math.abs(1.0 + sign(dx) * (dx / 100.0)));
    this.height = Math.max(5.0, 60 * Math.abs(1.0 + sign(dy) * (dy / 100.0)));
}

Node.prototype.draw = function(c) {
    if (this.nodeType == CIRCLE_NODE_T || this.nodeType == ACCEPT_STATE_NODE_T) {
        // draw the circle
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
        c.stroke();

        // draw the text
        drawText(c, this.text, this.x, this.y, null, selectedObject == this);

        // draw a double circle for an accept state
        if (this.nodeType == ACCEPT_STATE_NODE_T) {
            c.beginPath();
            c.arc(this.x, this.y, this.radius - 6, 0, 2 * Math.PI, false);
            c.stroke();
        }
    } else if (this.nodeType == RECTANGLE_NODE_T) {
        c.beginPath();
        c.strokeRect(this.x - this.width / 2.0, this.y - this.height / 2.0, this.width, this.height);
        c.stroke();
        // draw the text
        drawText(c, this.text, this.x, this.y, null, selectedObject == this);
    } else if (this.nodeType == TRIANGLE_NODE_T) {
        c.beginPath();
        c.moveTo(this.x, this.y  - this.height * 0.666);
        c.lineTo(this.x + this.width / 2.0, this.y + this.height * 0.3333);
        c.lineTo(this.x - this.width / 2.0, this.y + this.height * 0.3333);
        c.lineTo(this.x, this.y  - this.height * 0.666);
        c.stroke();

        drawText(c, this.text, this.x, this.y, null, selectedObject == this);
    } else if (this.nodeType == TEXT_NODE_T) {
        if (selectedObject == this) {
            var prev_strokestyle = c.strokeStyle;
            c.strokeStyle = 'grey';
            c.beginPath();
            c.strokeRect(this.x - this.width / 2.0, this.y - this.height / 2.0, this.width, this.height);
            c.stroke();
            c.strokeStyle = prev_strokestyle;
        }
        drawText(c, this.text, this.x, this.y, null, selectedObject == this, true);
    }
    if (selectedObject == this && snapInfo.x) {
        var prev_strokestyle = c.strokeStyle;
        c.strokeStyle = SNAP_COLOR;
        c.beginPath();
        c.moveTo(snapInfo.x_snap, 0);
        c.lineTo(snapInfo.x_snap, canvas.height);
        c.stroke();
        c.strokeStyle = prev_strokestyle;
    }
    if (selectedObject == this && snapInfo.y) {
        var prev_strokestyle = c.strokeStyle;
        c.strokeStyle = SNAP_COLOR;
        c.beginPath();
        c.moveTo(0, snapInfo.y_snap);
        c.lineTo(canvas.width, snapInfo.y_snap);
        c.stroke();
        c.strokeStyle = prev_strokestyle;
    }
};

Node.prototype.closestPointOnCircle = function(x, y) {

    var this_x = this.x,
        this_y = this.y;

    /*if (this.nodeType == TEXT_NODE_T) {
        this_x = this_x + this.width / 2.0;
    }*/

    var dx = x - this_x;
    var dy = y - this_y;
    var distance = Math.sqrt(dx * dx + dy * dy);

    if (this.nodeType == RECTANGLE_NODE_T || this.nodeType == TEXT_NODE_T) {
        var dx = x - this_x,
            dy = y - this_y;
        // angle is 0  when point is to the right of rectangle,
        // angle is pi when point is to left of rectangle.
        var angle = (2.0 * Math.PI + Math.atan2(
            dx,
            dy
        ) - (Math.PI / 2.0)) % (2.0 * Math.PI);
        var tan = Math.tan(angle);
        var h = distance * Math.sin(angle);
        var w = distance * Math.cos(angle);

        if (h > (this.height / 2.0)) {
            h = this.height / 2.0;
            // tan = opposite / adjacent
            // w is adjacent
            w = (1.0 / tan) * h;
        } else if (h <= -(this.height / 2.0)) {
            h = -this.height / 2.0;
            // tan = opposite / adjacent
            // w is adjacent
            w = (1.0 / tan) * h;

        } else if (w > (this.width / 2.0)) {
            w = this.width / 2.0;
            // tan = opposite / adjancent
            // h is opposite
            h = tan * w;
        } else if (w <= -(this.width / 2.0)) {
            w = -this.width / 2.0;
            // tan = opposite / adjancent
            // h is opposite
            h = tan * w;
        } else {
            // point is inside the rectangle
            return {
                'x': x,
                'y': y,
            };
        }
        return {
            'x': this_x + w,
            'y': this_y - h,
        };
    } else {

        return {
            'x': this_x + dx * this.radius / distance,
            'y': this_y + dy * this.radius / distance,
        };
    }
};

Node.prototype.containsPoint = function(x, y) {
    if (this.nodeType == CIRCLE_NODE_T || this.nodeType == ACCEPT_STATE_NODE_T) {
        return (x - this.x)*(x - this.x) + (y - this.y)*(y - this.y) < this.radius*this.radius;
    } else if (this.nodeType == TEXT_NODE_T || this.nodeType == RECTANGLE_NODE_T) {
        if ( x >= this.x - this.width / 2.0 && x <= this.x + this.width / 2.0) {
            if (y > this.y - this.height / 2.0 && y <= this.y + this.height / 2.0) {
                return true;
            }
        }
        return false;
    } else if (this.nodeType == TRIANGLE_NODE_T) {
        if (y > this.y + this.height * 0.333 || y < this.y - this.height * 0.6666) {
            return false;
        }
        if (x < this.x && x >= this.x - this.width / 2.0) {
            var dx = x - (this.x - this.width  / 2.0),
                dy = (this.y + this.height * 0.3333) - y;
            if ((dy / dx) < this.height / (this.width / 2.0)) {
                return true;
            }
            return false;
        } else if (x > this.x && x <= this.x + this.width / 2.0) {
            var dx = (this.x - x + this.width  / 2.0),
                dy = (this.y + this.height * 0.3333) - y;
            if ((dy / dx) < this.height / (this.width / 2.0)) {
                return true;
            }
            return false;
        }
        return false;
    }




};

function SelfLink(node, mouse) {
    this.node = node;
    this.anchorAngle = 0;
    this.mouseOffsetAngle = 0;
    this.text = '';

    if(mouse) {
        this.setAnchorPoint(mouse.x, mouse.y);
    }
}

SelfLink.prototype.setMouseStart = function(x, y) {
    this.mouseOffsetAngle = this.anchorAngle - Math.atan2(y - this.node.y, x - this.node.x);
};

SelfLink.prototype.setAnchorPoint = function(x, y) {
    this.anchorAngle = Math.atan2(y - this.node.y, x - this.node.x) + this.mouseOffsetAngle;
    // snap to 90 degrees
    var snap = Math.round(this.anchorAngle / (Math.PI / 2)) * (Math.PI / 2);
    if(Math.abs(this.anchorAngle - snap) < 0.1) this.anchorAngle = snap;
    // keep in the range -pi to pi so our containsPoint() function always works
    if(this.anchorAngle < -Math.PI) this.anchorAngle += 2 * Math.PI;
    if(this.anchorAngle > Math.PI) this.anchorAngle -= 2 * Math.PI;
};

SelfLink.prototype.getEndPointsAndCircle = function() {
    var circleX = this.node.x + 1.5 * this.node.radius * Math.cos(this.anchorAngle);
    var circleY = this.node.y + 1.5 * this.node.radius * Math.sin(this.anchorAngle);
    var circleRadius = 0.75 * this.node.radius;
    var startAngle = this.anchorAngle - Math.PI * 0.8;
    var endAngle = this.anchorAngle + Math.PI * 0.8;
    var startX = circleX + circleRadius * Math.cos(startAngle);
    var startY = circleY + circleRadius * Math.sin(startAngle);
    var endX = circleX + circleRadius * Math.cos(endAngle);
    var endY = circleY + circleRadius * Math.sin(endAngle);
    return {
        'hasCircle': true,
        'startX': startX,
        'startY': startY,
        'endX': endX,
        'endY': endY,
        'startAngle': startAngle,
        'endAngle': endAngle,
        'circleX': circleX,
        'circleY': circleY,
        'circleRadius': circleRadius
    };
};

SelfLink.prototype.draw = function(c) {
    var stuff = this.getEndPointsAndCircle();
    // draw arc
    c.beginPath();
    c.arc(stuff.circleX, stuff.circleY, stuff.circleRadius, stuff.startAngle, stuff.endAngle, false);
    c.stroke();
    // draw the text on the loop farthest from the node
    var textX = stuff.circleX + stuff.circleRadius * Math.cos(this.anchorAngle);
    var textY = stuff.circleY + stuff.circleRadius * Math.sin(this.anchorAngle);
    drawText(c, this.text, textX, textY, this.anchorAngle, selectedObject == this);
    // draw the head of the arrow
    drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle + Math.PI * 0.4);
};

SelfLink.prototype.containsPoint = function(x, y) {
    var stuff = this.getEndPointsAndCircle();
    var dx = x - stuff.circleX;
    var dy = y - stuff.circleY;
    var distance = Math.sqrt(dx*dx + dy*dy) - stuff.circleRadius;
    return (Math.abs(distance) < hitTargetPadding);
};

function StartLink(node, start) {
    this.node = node;
    this.deltaX = 0;
    this.deltaY = 0;
    this.text = '';

    if(start) {
        this.setAnchorPoint(start.x, start.y);
    }
}

StartLink.prototype.setAnchorPoint = function(x, y) {
    this.deltaX = x - this.node.x;
    this.deltaY = y - this.node.y;

    if(Math.abs(this.deltaX) < snapToPadding) {
        this.deltaX = 0;
    }

    if(Math.abs(this.deltaY) < snapToPadding) {
        this.deltaY = 0;
    }
};

StartLink.prototype.getEndPoints = function() {
    var startX = this.node.x + this.deltaX;
    var startY = this.node.y + this.deltaY;
    var end = this.node.closestPointOnCircle(startX, startY);
    return {
        'startX': startX,
        'startY': startY,
        'endX': end.x,
        'endY': end.y,
    };
};

StartLink.prototype.draw = function(c) {
    var stuff = this.getEndPoints();

    // draw the line
    c.beginPath();
    c.moveTo(stuff.startX, stuff.startY);
    c.lineTo(stuff.endX, stuff.endY);
    c.stroke();

    // draw the text at the end without the arrow
    var textAngle = Math.atan2(stuff.startY - stuff.endY, stuff.startX - stuff.endX);
    drawText(c, this.text, stuff.startX, stuff.startY, textAngle, selectedObject == this);

    // draw the head of the arrow
    drawArrow(c, stuff.endX, stuff.endY, Math.atan2(-this.deltaY, -this.deltaX));
};

StartLink.prototype.containsPoint = function(x, y) {
    var stuff = this.getEndPoints();
    var dx = stuff.endX - stuff.startX;
    var dy = stuff.endY - stuff.startY;
    var length = Math.sqrt(dx*dx + dy*dy);
    var percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
    var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
    return (percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding);
};

function TemporaryLink(from, to) {
    this.from = from;
    this.to = to;
}

TemporaryLink.prototype.draw = function(c) {
    // draw the line
    c.beginPath();
    c.moveTo(this.to.x, this.to.y);
    c.lineTo(this.from.x, this.from.y);
    c.stroke();

    // draw the head of the arrow
    drawArrow(c, this.to.x, this.to.y, Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x));
};

// draw using this instead of a canvas and call toLaTeX() afterward
function ExportAsLaTeX() {
    this._points = [];
    this._texData = '';
    this._scale = 0.1; // to convert pixels to document space (TikZ breaks if the numbers get too big, above 500?)

    this.toLaTeX = function() {
        return '\\documentclass[12pt]{article}\n' +
            '\\usepackage{tikz}\n' +
            '\n' +
            '\\begin{document}\n' +
            '\n' +
            '\\begin{center}\n' +
            '\\begin{tikzpicture}[scale=0.2]\n' +
            '\\tikzstyle{every node}+=[inner sep=0pt]\n' +
            this._texData +
            '\\end{tikzpicture}\n' +
            '\\end{center}\n' +
            '\n' +
            '\\end{document}\n';
    };

    this.beginPath = function() {
        this._points = [];
    };
    this.arc = function(x, y, radius, startAngle, endAngle, isReversed) {
        x *= this._scale;
        y *= this._scale;
        radius *= this._scale;
        if(endAngle - startAngle == Math.PI * 2) {
            this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x, 3) + ',' + fixed(-y, 3) + ') circle (' + fixed(radius, 3) + ');\n';
        } else {
            if(isReversed) {
                var temp = startAngle;
                startAngle = endAngle;
                endAngle = temp;
            }
            if(endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }
            // TikZ needs the angles to be in between -2pi and 2pi or it breaks
            if(Math.min(startAngle, endAngle) < -2*Math.PI) {
                startAngle += 2*Math.PI;
                endAngle += 2*Math.PI;
            } else if(Math.max(startAngle, endAngle) > 2*Math.PI) {
                startAngle -= 2*Math.PI;
                endAngle -= 2*Math.PI;
            }
            startAngle = -startAngle;
            endAngle = -endAngle;
            this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x + radius * Math.cos(startAngle), 3) + ',' + fixed(-y + radius * Math.sin(startAngle), 3) + ') arc (' + fixed(startAngle * 180 / Math.PI, 5) + ':' + fixed(endAngle * 180 / Math.PI, 5) + ':' + fixed(radius, 3) + ');\n';
        }
    };


    this.strokeRect = function (x, y, width, height) {
        x *= this._scale;
        y *= this._scale;
        width  *= this._scale;
        height *= this._scale;
        this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x, 3) + ',' + fixed(-y, 3) + ') rectangle ('  + fixed(x + width, 3) + ',' + fixed(-y - height, 3) + ');\n';
    };

    this.moveTo = this.lineTo = function(x, y) {
        x *= this._scale;
        y *= this._scale;
        this._points.push({ 'x': x, 'y': y });
    };
    this.stroke = function() {
        if(this._points.length == 0) return;
        this._texData += '\\draw [' + this.strokeStyle + ']';
        for(var i = 0; i < this._points.length; i++) {
            var p = this._points[i];
            this._texData += (i > 0 ? ' --' : '') + ' (' + fixed(p.x, 2) + ',' + fixed(-p.y, 2) + ')';
        }
        this._texData += ';\n';
    };


    this.fill = function() {
        if(this._points.length == 0) return;
        this._texData += '\\fill [' + this.strokeStyle + ']';
        for(var i = 0; i < this._points.length; i++) {
            var p = this._points[i];
            this._texData += (i > 0 ? ' --' : '') + ' (' + fixed(p.x, 2) + ',' + fixed(-p.y, 2) + ')';
        }
        this._texData += ';\n';
    };
    this.measureText = function(text) {
        var c = canvas.getContext('2d');
        c.font = '20px "Times New Romain", serif';
        return c.measureText(text);
    };
    this.advancedFillText = function(text, originalText, x, y, angleOrNull) {
        if(text.replace(' ', '').length > 0) {
            var nodeParams = '';
            // x and y start off as the center of the text, but will be moved to one side of the box when angleOrNull != null
            if(angleOrNull != null) {
                var width = this.measureText(text).width;
                var dx = Math.cos(angleOrNull);
                var dy = Math.sin(angleOrNull);
                if(Math.abs(dx) > Math.abs(dy)) {
                    if(dx > 0) nodeParams = '[right] ', x -= width / 2;
                    else nodeParams = '[left] ', x += width / 2;
                } else {
                    if(dy > 0) nodeParams = '[below] ', y -= 10;
                    else nodeParams = '[above] ', y += 10;
                }
            }
            x *= this._scale;
            y *= this._scale;
            this._texData += '\\draw (' + fixed(x, 2) + ',' + fixed(-y, 2) + ') node ' + nodeParams + '{$' + originalText.replace(/ /g, '\\mbox{ }') + '$};\n';
        }
    };

    this.translate = this.save = this.restore = this.clearRect = function(){};
}

// draw using this instead of a canvas and call toSVG() afterward
function ExportAsSVG() {
    this.fillStyle = 'black';
    this.strokeStyle = 'black';
    this.lineWidth = 1;
    this.font = '12px Arial, sans-serif';
    this._points = [];
    this._svgData = '';
    this._transX = 0;
    this._transY = 0;

    this.toSVG = function() {
        return '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n<svg width="800" height="600" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' + this._svgData + '</svg>\n';
    };

    this.beginPath = function() {
        this._points = [];
    };
    this.arc = function(x, y, radius, startAngle, endAngle, isReversed) {
        x += this._transX;
        y += this._transY;
        var style = 'stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" fill="none"';

        if(endAngle - startAngle == Math.PI * 2) {
            this._svgData += '\t<ellipse ' + style + ' cx="' + fixed(x, 3) + '" cy="' + fixed(y, 3) + '" rx="' + fixed(radius, 3) + '" ry="' + fixed(radius, 3) + '"/>\n';
        } else {
            if(isReversed) {
                var temp = startAngle;
                startAngle = endAngle;
                endAngle = temp;
            }

            if(endAngle < startAngle) {
                endAngle += Math.PI * 2;
            }

            var startX = x + radius * Math.cos(startAngle);
            var startY = y + radius * Math.sin(startAngle);
            var endX = x + radius * Math.cos(endAngle);
            var endY = y + radius * Math.sin(endAngle);
            var useGreaterThan180 = (Math.abs(endAngle - startAngle) > Math.PI);
            var goInPositiveDirection = 1;

            this._svgData += '\t<path ' + style + ' d="';
            this._svgData += 'M ' + fixed(startX, 3) + ',' + fixed(startY, 3) + ' '; // startPoint(startX, startY)
            this._svgData += 'A ' + fixed(radius, 3) + ',' + fixed(radius, 3) + ' '; // radii(radius, radius)
            this._svgData += '0 '; // value of 0 means perfect circle, others mean ellipse
            this._svgData += +useGreaterThan180 + ' ';
            this._svgData += +goInPositiveDirection + ' ';
            this._svgData += fixed(endX, 3) + ',' + fixed(endY, 3); // endPoint(endX, endY)
            this._svgData += '"/>\n';
        }
    };
    this.moveTo = this.lineTo = function(x, y) {
        x += this._transX;
        y += this._transY;
        this._points.push({ 'x': x, 'y': y });
    };
    this.stroke = function() {
        if(this._points.length == 0) return;
        this._svgData += '\t<polygon stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" points="';
        for(var i = 0; i < this._points.length; i++) {
            this._svgData += (i > 0 ? ' ' : '') + fixed(this._points[i].x, 3) + ',' + fixed(this._points[i].y, 3);
        }
        this._svgData += '"/>\n';
    };
    this.fill = function() {
        if(this._points.length == 0) return;
        this._svgData += '\t<polygon fill="' + this.fillStyle + '" stroke-width="' + this.lineWidth + '" points="';
        for(var i = 0; i < this._points.length; i++) {
            this._svgData += (i > 0 ? ' ' : '') + fixed(this._points[i].x, 3) + ',' + fixed(this._points[i].y, 3);
        }
        this._svgData += '"/>\n';
    };
    this.measureText = function(text) {
        var c = canvas.getContext('2d');
        c.font = '20px "Times New Romain", serif';
        return c.measureText(text);
    };
    this.fillText = function(text, x, y) {
        x += this._transX;
        y += this._transY;
        if(text.replace(' ', '').length > 0) {
            this._svgData += '\t<text x="' + fixed(x, 3) + '" y="' + fixed(y, 3) + '" font-family="Times New Roman" font-size="20">' + textToXML(text) + '</text>\n';
        }
    };
    this.translate = function(x, y) {
        this._transX = x;
        this._transY = y;
    };

    this.save = this.restore = this.clearRect = function(){};
}

var greekLetterNames = [ 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega' ];

function convertLatexShortcuts(text) {
    // html greek characters
    for(var i = 0; i < greekLetterNames.length; i++) {
        var name = greekLetterNames[i];
        text = text.replace(new RegExp('\\\\' + name, 'g'), String.fromCharCode(913 + i + (i > 16)));
        text = text.replace(new RegExp('\\\\' + name.toLowerCase(), 'g'), String.fromCharCode(945 + i + (i > 16)));
    }

    // subscripts
    for(var i = 0; i < 10; i++) {
        text = text.replace(new RegExp('_' + i, 'g'), String.fromCharCode(8320 + i));
    }

    return text;
}

function textToXML(text) {
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var result = '';
    for(var i = 0; i < text.length; i++) {
        var c = text.charCodeAt(i);
        if(c >= 0x20 && c <= 0x7E) {
            result += text[i];
        } else {
            result += '&#' + c + ';';
        }
    }
    return result;
}

function drawArrow(c, x, y, angle) {
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
    c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
    c.fill();
}

function canvasHasFocus() {
    return (document.activeElement || document.body) == document.body;
}

function drawText(c, originalText, x, y, angleOrNull, isSelected, alignCenter) {
    text = convertLatexShortcuts(originalText);
    c.font = '20px "Times New Roman", serif';
    var width = c.measureText(text).width;

    if (alignCenter === undefined )
        alignCenter = true;

    if (alignCenter) {
        // center the text
        x -= width / 2;
    }

    // position the text intelligently if given an angle
    if(angleOrNull != null) {
        var cos = Math.cos(angleOrNull);
        var sin = Math.sin(angleOrNull);
        var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
        var cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);
        var slide = sin * Math.pow(Math.abs(sin), 40) * cornerPointX - cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
        x += cornerPointX - sin * slide;
        y += cornerPointY + cos * slide;
    }

    // draw text and caret (round the coordinates so the caret falls on a pixel)
    if('advancedFillText' in c) {
        c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
    } else {
        x = Math.round(x);
        y = Math.round(y);
        c.fillText(text, x, y + 6);
        if(isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
            x += width;
            c.beginPath();
            c.moveTo(x, y - 10);
            c.lineTo(x, y + 10);
            c.stroke();
        }
    }
}

var caretTimer;
var caretVisible = true;

function resetCaret() {
    clearInterval(caretTimer);
    caretTimer = setInterval('caretVisible = !caretVisible; draw()', 500);
    caretVisible = true;
}

var canvas;
var nodes = [];
var links = [];
var figurename = "Untitled";
var cursorVisible = true;
var snapToPadding = 6; // pixels
var hitTargetPadding = 6; // pixels
var selectedObject = null; // either a Link or a Node
var currentLink = null; // a Link
var movingObject = false,
    resizingObject = false,
    alt_resizes = false,
    snapInfo = {
        x:false,
        y:false,
        y_snap: null,
        x_snap: null
    };
var originalClick;

function drawUsing(c) {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(0.5, 0.5);

    for(var i = 0; i < nodes.length; i++) {
        c.lineWidth = 1;
        c.fillStyle = c.strokeStyle = (nodes[i] == selectedObject) ? 'blue' : 'black';
        nodes[i].draw(c);
    }
    for(var i = 0; i < links.length; i++) {
        c.lineWidth = 1;
        c.fillStyle = c.strokeStyle = (links[i] == selectedObject) ? 'blue' : 'black';
        links[i].draw(c);
    }
    if(currentLink != null) {
        c.lineWidth = 1;
        c.fillStyle = c.strokeStyle = 'black';
        currentLink.draw(c);
    }

    c.restore();
}

function draw() {
    drawUsing(canvas.getContext('2d'));
    saveBackup();
}

function selectObject(x, y) {
    for(var i = 0; i < nodes.length; i++) {
        if(nodes[i].containsPoint(x, y)) {
            return nodes[i];
        }
    }
    for(var i = 0; i < links.length; i++) {
        if(links[i].containsPoint(x, y)) {
            return links[i];
        }
    }
    return null;
}

function snapNode(node) {
    var min_x_snap = null,
        min_y_snap = null,
        new_dx     = null,
        new_dy     = null,
        y_snap     = null,
        x_snap     = null;

    for(var i = 0; i < nodes.length; i++) {
        if (nodes[i] == node) continue;

        var deltaxs = [
            [nodes[i].x           - node.x,           nodes[i].x],
            [nodes[i].leftSide()  - node.x,           nodes[i].leftSide()],
            [nodes[i].rightSide() - node.x,           nodes[i].rightSide()],
            [nodes[i].leftSide()  - node.rightSide(), nodes[i].leftSide()],
            [nodes[i].rightSide() - node.leftSide(),  nodes[i].rightSide()],
            [nodes[i].rightSide() - node.rightSide(), nodes[i].rightSide()],
            [nodes[i].leftSide()  - node.leftSide(),  nodes[i].leftSide()]
        ];

        for (var deltaxs_idx = 0; deltaxs_idx < deltaxs.length;deltaxs_idx++) {
            var delta_x = Math.abs(deltaxs[deltaxs_idx][0]);
            if (delta_x < snapToPadding) {
                if (min_x_snap === null) {
                    min_x_snap = delta_x;
                    new_dx = deltaxs[deltaxs_idx][0];
                    x_snap = deltaxs[deltaxs_idx][1];
                } else if (delta_x < min_x_snap) {
                    min_x_snap = delta_x;
                    new_dx = deltaxs[deltaxs_idx][0];
                    x_snap = deltaxs[deltaxs_idx][1];
                }
            }
        }

        var deltays = [
            [nodes[i].y            - node.y,            nodes[i].y],
            [nodes[i].bottomSide() - node.topSide(),    nodes[i].bottomSide()],
            [nodes[i].topSide()    - node.bottomSide(), nodes[i].topSide()],
            [nodes[i].topSide()    - node.topSide(),    nodes[i].topSide()],
            [nodes[i].bottomSide() - node.bottomSide(), nodes[i].bottomSide()],
        ];

        for (var deltays_idx = 0; deltays_idx < deltays.length;deltays_idx++) {
            var delta_y = Math.abs(deltays[deltays_idx][0]);
            if (delta_y < snapToPadding) {
                if (min_y_snap === null) {
                    min_y_snap = delta_y;
                    new_dy = deltays[deltays_idx][0];
                    y_snap = deltays[deltays_idx][1];
                } else if (delta_y < min_y_snap) {
                    min_y_snap = delta_y;
                    new_dy = deltays[deltays_idx][0];
                    y_snap = deltays[deltays_idx][1];
                }
            }
        }
    }
    if (new_dy !== null) node.y = node.y + new_dy;
    if (new_dx !== null) node.x = node.x + new_dx;

    return {
        y: new_dy !== null,
        y_snap: y_snap,
        x: new_dx !== null,
        x_snap: x_snap
    };
}

window.onload = function() {
    canvas = document.getElementById('canvas');
    restoreBackup();
    draw();

    canvas.onmousedown = function(e) {
        var mouse = crossBrowserRelativeMousePos(e);
        selectedObject = selectObject(mouse.x, mouse.y);
        movingObject   = false;
        resizingObject = false;
        originalClick  = mouse;

        if(selectedObject != null) {
            if(shift && selectedObject instanceof Node) {
                currentLink = new SelfLink(selectedObject, mouse);
            } else if (alt_resizes && alt && selectedObject instanceof Node) {
                resizingObject = true;
                deltaMouseX = deltaMouseY = 0;
                if (selectedObject.setMouseStart) {
                    selectedObject.setMouseStart(mouse.x, mouse.y);
                }
            } else if (!alt_resizes && alt && selectedObject instanceof Node) {
                selectedObject = selectedObject.clone();
                nodes.push(selectedObject);
                movingObject = true;
                deltaMouseX = deltaMouseY = 0;
                if(selectedObject.setMouseStart) {
                    selectedObject.setMouseStart(mouse.x, mouse.y);
                }
                resetCaret();
            } else {
                movingObject = true;
                deltaMouseX = deltaMouseY = 0;
                if(selectedObject.setMouseStart) {
                    selectedObject.setMouseStart(mouse.x, mouse.y);
                }
            }
            resetCaret();
        } else if(shift) {
            currentLink = new TemporaryLink(mouse, mouse);
        }

        draw();

        if(canvasHasFocus()) {
            // disable drag-and-drop only if the canvas is already focused
            return false;
        } else {
            // otherwise, let the browser switch the focus away from wherever it was
            resetCaret();
            return true;
        }
    };

    canvas.ondblclick = function(e) {
        var mouse = crossBrowserRelativeMousePos(e);
        selectedObject = selectObject(mouse.x, mouse.y);

        if(selectedObject == null) {
            selectedObject = new Node(mouse.x, mouse.y);
            nodes.push(selectedObject);
            resetCaret();
            draw();
        } else if(selectedObject instanceof Node) {
            selectedObject.nodeType += 1;
            selectedObject.nodeType = selectedObject.nodeType % (MAX_NODE_T);

            if (selectedObject.nodeType == TEXT_NODE_T) {
                selectedObject.updateTextWidth();
            }

            draw();
        }
    };

    canvas.onmousemove = function(e) {
        var mouse = crossBrowserRelativeMousePos(e);
        snapInfo = {x:false,y:false,y_snap:null,x_snap:null};

        if(currentLink != null) {
            var targetNode = selectObject(mouse.x, mouse.y);
            if(!(targetNode instanceof Node)) {
                targetNode = null;
            }

            if(selectedObject == null) {
                if(targetNode != null) {
                    currentLink = new StartLink(targetNode, originalClick);
                } else {
                    currentLink = new TemporaryLink(originalClick, mouse);
                }
            } else {
                if(targetNode == selectedObject) {
                    currentLink = new SelfLink(selectedObject, mouse);
                } else if(targetNode != null) {
                    currentLink = new Link(selectedObject, targetNode);
                } else {
                    currentLink = new TemporaryLink(selectedObject.closestPointOnCircle(mouse.x, mouse.y), mouse);
                }
            }
            draw();
        }

        if(movingObject) {
            selectedObject.setAnchorPoint(mouse.x, mouse.y);
            if(selectedObject instanceof Node) {
                snapInfo = snapNode(selectedObject);
            }
            draw();
        }

        if (resizingObject) {
            if (selectedObject.nodeType !== TEXT_NODE_T) {
                selectedObject.setNewRadius(mouse.x, mouse.y);
                draw();
            }
        }
    };

    canvas.onmouseup = function(e) {
        movingObject   = false;
        resizingObject = false;

        if(currentLink != null) {
            if(!(currentLink instanceof TemporaryLink)) {
                selectedObject = currentLink;
                links.push(currentLink);
                resetCaret();
            }
            currentLink = null;
            draw();
        }
    };
}

var shift = false,
    alt = false;

document.onkeydown = function(e) {
    var key = crossBrowserKey(e);

    if(key == 16) {
        shift = true;
    } else if (key == 18) {
        alt   = true;
    } else if(!canvasHasFocus()) {
        // don't read keystrokes when other things have focus
        return true;
    } else if(key == 8) { // backspace key
        if(selectedObject != null && 'text' in selectedObject) {
            selectedObject.text = selectedObject.text.substr(0, selectedObject.text.length - 1);
            resetCaret();

            if (selectedObject.nodeType == TEXT_NODE_T) {
                selectedObject.updateTextWidth();
            }

            draw();
        }

        // backspace is a shortcut for the back button, but do NOT want to change pages
        return false;
    } else if(key == 46) { // delete key
        if(selectedObject != null) {
            for(var i = 0; i < nodes.length; i++) {
                if(nodes[i] == selectedObject) {
                    nodes.splice(i--, 1);
                }
            }
            for(var i = 0; i < links.length; i++) {
                if(links[i] == selectedObject || links[i].node == selectedObject || links[i].nodeA == selectedObject || links[i].nodeB == selectedObject) {
                    links.splice(i--, 1);
                }
            }
            selectedObject = null;

            if (selectedObject.nodeType == TEXT_NODE_T) {
                selectedObject.updateTextWidth();
            }

            draw();
        }
    }
};

document.onkeyup = function(e) {
    var key = crossBrowserKey(e);
    if(key == 16) {
        shift = false;
    } else if (key == 18) {
        alt = false;
    }
};

document.onkeypress = function(e) {
    // don't read keystrokes when other things have focus
    var key = crossBrowserKey(e);
    if(!canvasHasFocus()) {
        // don't read keystrokes when other things have focus
        return true;
    } else if(key >= 0x20 && key <= 0x7E && !e.metaKey && !e.altKey && !e.ctrlKey && selectedObject != null && 'text' in selectedObject) {
        selectedObject.text += String.fromCharCode(key);
        resetCaret();
        if (selectedObject.nodeType == TEXT_NODE_T) {
            selectedObject.updateTextWidth();
        }
        draw();

        // don't let keys do their actions (like space scrolls down the page)
        return false;
    } else if(key == 8) {
        // backspace is a shortcut for the back button, but do NOT want to change pages
        return false;
    }
};

function crossBrowserKey(e) {
    e = e || window.event;
    return e.which || e.keyCode;
}

function crossBrowserElementPos(e) {
    e = e || window.event;
    var obj = e.target || e.srcElement;
    var x = 0, y = 0;
    while(obj.offsetParent) {
        x += obj.offsetLeft;
        y += obj.offsetTop;
        obj = obj.offsetParent;
    }
    return { 'x': x, 'y': y };
}

function crossBrowserMousePos(e) {
    e = e || window.event;
    return {
        'x': e.pageX || e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
        'y': e.pageY || e.clientY + document.body.scrollTop + document.documentElement.scrollTop,
    };
}

function crossBrowserRelativeMousePos(e) {
    var element = crossBrowserElementPos(e);
    var mouse = crossBrowserMousePos(e);
    return {
        'x': mouse.x - element.x,
        'y': mouse.y - element.y
    };
}

function output(text) {
    var element = document.getElementById('output');
    element.style.display = 'block';
    element.value = text;
}

function saveAsPNG() {
    var oldSelectedObject = selectedObject;
    selectedObject = null;
    drawUsing(canvas.getContext('2d'));
    selectedObject = oldSelectedObject;
    var pngData = canvas.toDataURL('image/png');
    document.location.href = pngData;
}

function saveAsSVG() {
    var exporter = new ExportAsSVG();
    var oldSelectedObject = selectedObject;
    selectedObject = null;
    drawUsing(exporter);
    selectedObject = oldSelectedObject;
    var svgData = exporter.toSVG();
    output(svgData);
    // Chrome isn't ready for this yet, the 'Save As' menu item is disabled
    // document.location.href = 'data:image/svg+xml;base64,' + btoa(svgData);
}

function saveAsLaTeX() {
    var exporter = new ExportAsLaTeX();
    var oldSelectedObject = selectedObject;
    selectedObject = null;
    drawUsing(exporter);
    selectedObject = oldSelectedObject;
    var texData = exporter.toLaTeX();
    output(texData);
}

function det(a, b, c, d, e, f, g, h, i) {
    return a*e*i + b*f*g + c*d*h - a*f*h - b*d*i - c*e*g;
}

function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
    var a = det(x1, y1, 1, x2, y2, 1, x3, y3, 1);
    var bx = -det(x1*x1 + y1*y1, y1, 1, x2*x2 + y2*y2, y2, 1, x3*x3 + y3*y3, y3, 1);
    var by = det(x1*x1 + y1*y1, x1, 1, x2*x2 + y2*y2, x2, 1, x3*x3 + y3*y3, x3, 1);
    var c = -det(x1*x1 + y1*y1, x1, y1, x2*x2 + y2*y2, x2, y2, x3*x3 + y3*y3, x3, y3);
    return {
        'x': -bx / (2*a),
        'y': -by / (2*a),
        'radius': Math.sqrt(bx*bx + by*by - 4*a*c) / (2*Math.abs(a))
    };
}

function fixed(number, digits) {
    return number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

function restoreBackup() {
    if(!localStorage || !JSON) {
        return;
    }

    try {
        var all_backup = JSON.parse(localStorage['fsm']) || {};

        if (all_backup[figurename] !== undefined) {
            var backup = all_backup[figurename];

            for(var i = 0; i < backup.nodes.length; i++) {
                var backupNode = backup.nodes[i];
                var node = new Node(backupNode.x, backupNode.y);
                node.nodeType = backupNode.nodeType;
                node.radius = backupNode.radius || 30.0;
                node.width  = backupNode.width  || 60.0;
                node.height = backupNode.height || 60.0;
                node.text = backupNode.text;
                nodes.push(node);
            }
            for(var i = 0; i < backup.links.length; i++) {
                var backupLink = backup.links[i];
                var link = null;
                if(backupLink.type == 'SelfLink') {
                    link = new SelfLink(nodes[backupLink.node]);
                    link.anchorAngle = backupLink.anchorAngle;
                    link.text = backupLink.text;
                } else if(backupLink.type == 'StartLink') {
                    link = new StartLink(nodes[backupLink.node]);
                    link.deltaX = backupLink.deltaX;
                    link.deltaY = backupLink.deltaY;
                    link.text = backupLink.text;
                } else if(backupLink.type == 'Link') {
                    link = new Link(nodes[backupLink.nodeA], nodes[backupLink.nodeB]);
                    link.parallelPart = backupLink.parallelPart;
                    link.perpendicularPart = backupLink.perpendicularPart;
                    link.text = backupLink.text;
                    link.lineAngleAdjust = backupLink.lineAngleAdjust;
                }
                if(link != null) {
                    links.push(link);
                }
            }
        }
    } catch(e) {
        localStorage['fsm'] = '';
    }
}

function addToBackup(newfig, newfigname) {
    var cur_backup = JSON.parse(localStorage['fsm']) || {};
    cur_backup[newfigname] = newfig;
    localStorage['fsm'] = JSON.stringify(cur_backup);
}

function saveBackup() {
    if(!localStorage || !JSON) {
        return;
    }

    var backup = {
        'nodes': [],
        'links': [],
    };
    for(var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var backupNode = {
            'x': node.x,
            'y': node.y,
            'text': node.text,
            'nodeType': node.nodeType,
            'radius': node.radius,
            'width': node.width,
            'height': node.height
        };
        backup.nodes.push(backupNode);
    }
    for(var i = 0; i < links.length; i++) {
        var link = links[i];
        var backupLink = null;
        if(link instanceof SelfLink) {
            backupLink = {
                'type': 'SelfLink',
                'node': nodes.indexOf(link.node),
                'text': link.text,
                'anchorAngle': link.anchorAngle,
            };
        } else if(link instanceof StartLink) {
            backupLink = {
                'type': 'StartLink',
                'node': nodes.indexOf(link.node),
                'text': link.text,
                'deltaX': link.deltaX,
                'deltaY': link.deltaY,
            };
        } else if(link instanceof Link) {
            backupLink = {
                'type': 'Link',
                'nodeA': nodes.indexOf(link.nodeA),
                'nodeB': nodes.indexOf(link.nodeB),
                'text': link.text,
                'lineAngleAdjust': link.lineAngleAdjust,
                'parallelPart': link.parallelPart,
                'perpendicularPart': link.perpendicularPart,
            };
        }
        if(backupLink != null) {
            backup.links.push(backupLink);
        }
    }

    addToBackup(backup, figurename);
}

