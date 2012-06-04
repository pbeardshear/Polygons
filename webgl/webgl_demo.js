// Global vars
var gl,
	mvMatrix,
	pMatrix,
	shaderPrograms,
	triangleVertexPositionBuffer,
	triangleVertexColorBuffer,
	squareVertexPositionBuffer,
	squareVertexColorBuffer;

//
//	Initialization method
//
function webGLStart() {
	var canvas = document.getElementById('polygons');
	initGL(canvas);
	initShaders();
	initBuffers();
	
	gl.clearColor(0.40784, 0.6, 0.827, 1.0);
	gl.enable(gl.DEPTH_TEST);
	
	canvas.onmousedown = handleMouseDown;
	document.onmouseup = handleMouseUp;
	document.onmousemove = handleMouseMove;
	
	tick();
}

//
//	Animation
//
function tick() {
	requestAnimFrame(tick);
	drawScene();
}

function degToRad(degrees) {
	return degrees * Math.PI / 180;
}

var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;

var moonRotationMatrix = mat4.create();
mat4.identity(moonRotationMatrix);

function handleMouseDown(event) {
	mouseDown = true;
	lastMouseX = event.clientX;
	lastMouseY = event.clientY;
}


function handleMouseUp(event) {
	mouseDown = false;
}


function handleMouseMove(event) {
	if (!mouseDown) {
		return;
	}
	var newX = event.clientX;
	var newY = event.clientY;

	var deltaX = newX - lastMouseX
	var newRotationMatrix = mat4.create();
	mat4.identity(newRotationMatrix);
	mat4.rotate(newRotationMatrix, degToRad(deltaX / 2), [0, 1, 0]);

	var deltaY = newY - lastMouseY;
	mat4.rotate(newRotationMatrix, degToRad(deltaY / 2), [1, 0, 0]);

	mat4.multiply(newRotationMatrix, moonRotationMatrix, moonRotationMatrix);

	lastMouseX = newX
	lastMouseY = newY;
}


//
//	Initialize WebGL
//
function initGL(canvas) {
	try {
		gl = canvas.getContext('experimental-webgl');
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
		
		mvMatrix = mat4.create();
		pMatrix = mat4.create();
	}
	catch(ex) {
		console.error(ex);
		throw new Error('Unable to initialize WebGL.');
	}
}

// Convenience method for initializing shaders
function getShader(gl, id) {
	var shaderScript = document.getElementById(id);
	if (!shaderScript) {
		return null;
	}
	
	var shaderStr = '',
		k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3) {
			shaderStr += k.textContent;
		}
		k = k.nextSibling;
	}
	
	var shader;
	switch (shaderScript.type) {
		case 'x-shader/x-fragment':
			shader = gl.createShader(gl.FRAGMENT_SHADER);
			break;
		case 'x-shader/x-vertex':
			shader = gl.createShader(gl.VERTEX_SHADER);
			break;
		default:
			return null;
			break;
	}
	gl.shaderSource(shader, shaderStr);
	gl.compileShader(shader);
	
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(shader));
		return null;
	}
	
	return shader;
}

function initShaders() {
	var fragmentShader = getShader(gl, 'shader-fs'),
		vertexShader = getShader(gl, 'shader-vs');
	shaderProgram = gl.createProgram();
	// Each shader program can support one vertex and one fragment shader
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);
	
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		throw new Error('Could not initialize shaders');
	}
	gl.useProgram(shaderProgram);
	// Shader position
	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	// Shader color
	shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, 'aVertexColor');
	gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
	
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, 'uPMatrix');
	shaderProgram.mvMatrixUniform =  gl.getUniformLocation(shaderProgram, 'uMVMatrix');
}

//
//	Convenience function for converting a hex string to an array of [R,G,B,A]
//
function hexToArgb(hex) {
	var hexstr = hex;
	if (hex[0] == '#') {
		hexstr = hex.substring(1);
	}
	var r = parseInt(hexstr.substring(0, 2), 16),
		g = parseInt(hexstr.substring(2, 4), 16),
		b = parseInt(hexstr.substring(4), 16);
	return [r / 255, g / 255, b / 255, 1.0];
}

// Return the triangle whose position is transformed from
// the default <canvas> coordinate system to the WebGL one
function transformPosition(center, edge) {
	var ratio = gl.viewportWidth / gl.viewportHeight,
		width = 400,
		height = 200,
		xOffset = width / 2,
		yOffset = height / 2,
		vertices = [],
		start = edge.start,
		end = edge.end;
	// console.log(width, height, xOffset, yOffset);
	vertices = vertices.concat([
		(center.pos.x - xOffset) / width, 
		(-center.pos.y + yOffset) / height, 
		center.ocean ? 0.0 : center.elevation / 50]
	);
	vertices = vertices.concat([
		(start.pos.x - xOffset) / width, 
		(-start.pos.y + yOffset) / height, 
		start.land ? start.elevation / 50 : 0.0
	]);
	vertices = vertices.concat([
		(end.pos.x - xOffset) / width, 
		(-end.pos.y + yOffset) / height, 
		end.land ? end.elevation / 50 : 0.0
	]);
	// console.log(vertices);
	return vertices;
}

//
//	Initialize drawing buffers for each shape
//
var positionBuffers = [],
	colorBuffers = [];
	
function initBuffers() {
	var centers = Polygons.centers,
		corners = Polygons.corners,
		currentBuffer,
		currentColorBuffer,
		vertices,
		colors,
		edges;
	for (var i = 0; i < centers.length; i++) {
		// currentBuffer = gl.createBuffer();
		// gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
		vertices = [];
		edges = centers[i].edges;
		// Currently just draw triangles between the centroid position and the start/end
		// points of the current edge
		for (var j = 0; j < edges.length; j++) {
			// polygon center
			currentBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
			vertices = transformPosition(centers[i], edges[j]);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
			currentBuffer.itemSize = 3;
			currentBuffer.numItems = 3;
			
			// Color
			currentColorBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, currentColorBuffer);
			colors = [];
			for (var k = 0; k < 3; k++) {
				colors = colors.concat(hexToArgb(centers[i].fill));
			}
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
			currentColorBuffer.itemSize = 4;
			currentColorBuffer.numItems = 3;
			
			positionBuffers.push(currentBuffer);
			colorBuffers.push(currentColorBuffer);
		}
		// gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		// currentBuffer.itemSize = 3;
		// currentBuffer.numItems = j;
		
		// Color
		// currentColorBuffer = gl.createBuffer();
		// gl.bindBuffer(gl.ARRAY_BUFFER, currentColorBuffer);
		// colors = [];
		// for (var k = 0; k < j; k++) {
			// colors = colors.concat(hexToArgb(centers[i].fill));
		// }
		// gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
		// currentColorBuffer.itemSize = 4;
		// currentColorBuffer.numItems = j;
		// Add the finished buffers to the queue
		// positionBuffers.push(currentBuffer);
		// colorBuffers.push(currentColorBuffer);
	}
}

// Convenience method for flushing an array buffer
function setMatrixUniforms() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//
//	Flush the buffer to WebGL and render to the screen
//
var first = true;
function drawScene() {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	// Set flags
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	// Set up the camera projection (perspective in this case, orthographic is default)
	mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
	// Reset the drawing matrix
	// if (first) {
		// mat4.identity(mvMatrix);
	// }
	// Draw the triangle
	// if (first) {
		// mat4.translate(mvMatrix, [-1.5, 0.0, -7.0]);
	// }
	for (var i = 0; i < positionBuffers.length; i++) {
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[i]);
		gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, positionBuffers[i].itemSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffers[i]);
		gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, colorBuffers[i].itemSize, gl.FLOAT, false, 0, 0);
		// Flush the vertices to the graphics card
		setMatrixUniforms();
		// Finally draw
		gl.drawArrays(gl.TRIANGLES, 0, positionBuffers[i].numItems);
	}	
	
	// Start the square
	// if (first) {
		// mat4.translate(mvMatrix, [3.0, 0.0, -10.0]);
	// }
	// gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexPositionBuffer);
	// gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, squareVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
	// gl.bindBuffer(gl.ARRAY_BUFFER, squareVertexColorBuffer);
	// gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, squareVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
	// setMatrixUniforms();
	// // gl.drawArrays(gl.TRIANGLE_STRIP, 0, squareVertexPositionBuffer.numItems);
	if (first) {
		first = false;
	}
	
	mat4.identity(mvMatrix);
	mat4.translate(mvMatrix, [0, 0, -6]);
	mat4.multiply(mvMatrix, moonRotationMatrix);
}
