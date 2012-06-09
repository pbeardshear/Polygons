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

	var deltaX = newX - lastMouseX,
		deltaY = newY - lastMouseY;
	var newRotationMatrix = mat4.create();
	mat4.identity(newRotationMatrix);
	//mat4.rotate(newRotationMatrix, degToRad(deltaX / 2), [0, 1, 0]);
	if (event.shiftKey) {
		mat4.rotate(newRotationMatrix, degToRad(deltaY / 4), [1, 0, 0]);
	}
	else {
		mat4.rotate(newRotationMatrix, degToRad(deltaX / 4), [0, Math.sin(degToRad(deltaY / 4)), Math.cos(degToRad(deltaY / 4))]);
	}
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
	
	// Shader normal
	shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);
	
	// Shader color
	shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, 'aVertexColor');
	gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
	
	
	
	
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, 'uPMatrix');
	shaderProgram.mvMatrixUniform =  gl.getUniformLocation(shaderProgram, 'uMVMatrix');
	
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
	shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
	shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
	shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
	shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
	shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
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
		width = gl.viewportWidth,
		height = gl.viewportHeight,
		xOffset = width / 2,
		yOffset = height / 2,
		vertices = [],
		start = edge.start,
		end = edge.end;
	// console.log(width, height, xOffset, yOffset);
	vertices = vertices.concat([
		(center.pos.x - xOffset) / width, 
		(-center.pos.y + yOffset) / height, 
		center.ocean ? 0.0 : center.elevation / 200]
	);
	vertices = vertices.concat([
		(start.pos.x - xOffset) / width, 
		(-start.pos.y + yOffset) / height, 
		start.land ? start.elevation / 200 : 0.0
	]);
	vertices = vertices.concat([
		(end.pos.x - xOffset) / width, 
		(-end.pos.y + yOffset) / height, 
		end.land ? end.elevation / 200 : 0.0
	]);
	// console.log(vertices);
	return vertices;
}

// Returns an array of points comprising the normals 
// of the plane formed by the center point and the start
// and end points of the edge
function computeNormals(center, edge) {
	var start = edge.start,
		end = edge.end,
		a = vec3.create([center.pos.x, center.pos.y, center.elevation * 5]),
		b = vec3.create([start.pos.x, start.pos.y, start.elevation * 5]),
		c = vec3.create([end.pos.x, end.pos.y, end.elevation * 5]),
		v1 = vec3.subtract(b, a, []),	// need empty array as output of operation, otherwise it is performed in place on the first argument
		v2 = vec3.subtract(c, a, []);
	
	// The normal can point in two directions
	// we always want the one that points "up" (i.e. positive z)
	var n1 = vec3.cross(v1, v2, []),
		n2 = vec3.cross(v2, v1, []),
		normal = vec3.normalize(n1[2] >= 0 ? n1 : n2),
		normalArray = Array.prototype.slice.call(normal);	// Return value is an object in the form of an array, not an actual array
	return normalArray.concat(normalArray, normalArray);	// All three vertices have the same normal
}

//
//	Initialize drawing buffers for each shape
//
var positionBuffers = [],
	colorBuffers = [],
	normalBuffers = [];
	
function initBuffers() {
	var centers = Polygons.centers,
		corners = Polygons.corners,
		currentBuffer,
		currentColorBuffer,
		currentNormalBuffer,
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
			
			// Normals
			currentNormalBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, currentNormalBuffer);
			vertices = computeNormals(centers[i], edges[j]);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
			currentNormalBuffer.itemSize = 3;
			currentNormalBuffer.numItems = 3;
			
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
			normalBuffers.push(currentNormalBuffer);
			colorBuffers.push(currentColorBuffer);
		}
	}
}

// Convenience method for flushing an array buffer
function setMatrixUniforms() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
	
	var normalMatrix = mat3.create();
	mat4.toInverseMat3(mvMatrix, normalMatrix);
	mat3.transpose(normalMatrix);
	gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
}

//
//	Flush the buffer to WebGL and render to the screen
//
var lighting = true;	// Enable uniform lighting
function drawScene() {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	// Set flags
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	// Set up the camera projection (perspective in this case)
	mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

	for (var i = 0; i < positionBuffers.length; i++) {
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[i]);
		gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, positionBuffers[i].itemSize, gl.FLOAT, false, 0, 0);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[i]);
		gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, normalBuffers[i].itemSize, gl.FLOAT, false, 0, 0);
		
		gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffers[i]);
		gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, colorBuffers[i].itemSize, gl.FLOAT, false, 0, 0);
		
		gl.uniform1i(shaderProgram.useLightingUniform, true);
		if (lighting) {
			// Ambient Light color
			gl.uniform3f(shaderProgram.ambientColorUniform, 0.8, 0.8, 0.8);
			// Light direction
			var lightingDirection = [0, -1, 0],
				adjustedLD = vec3.create();
			vec3.normalize(lightingDirection, adjustedLD);
			vec3.scale(adjustedLD, -1);
			gl.uniform3fv(shaderProgram.lightingDirectionUniform, adjustedLD);
			// Directional light color
			gl.uniform3f(shaderProgram.directionalColorUniform, 0.2, 0.2, 0.2);
		}
		// Flush the vertices to the graphics card
		setMatrixUniforms();
		// Finally draw
		gl.drawArrays(gl.TRIANGLES, 0, positionBuffers[i].numItems);
	}	

	mat4.identity(mvMatrix);
	mat4.translate(mvMatrix, [0, 0, -0.5]);
	mat4.multiply(mvMatrix, moonRotationMatrix);
}
