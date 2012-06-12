/*
 *
 *	Implementation of Lloyd's Algorithm for generating
 *	Voronoi polygons.
 *
 *	Cluster heuristic is average Euclidean distance to centroid.
 *	
 *	Implementation of Fortune's Algorithm taken from Raymond Hill <http://www.raymondhill.net/blog/?p=9>
 *
 */
 
Polygons = (function () {
	// Namespace for utility functions
	var util = {
		capitalize: function (str) {
			return str.substring(0, 1).toUpperCase() + str.substring(1);
		},
		getEdges: function (cell) {
			return cell.halfedges.map(function (he) { return { start: he.getStartpoint(), end: he.getEndpoint() } });
		}
	};
	
	// Bind some useful utility methods to the global namespace
	// The reason they are namespaced globally is so that they are available
	// to the map modules
	window.iter = function (container, scope, fn) {
		if (!fn) {
			// User didn't pass in a scope, so the callback is the second argument
			fn = scope;
			scope = container;
		}
		if (Array.isArray(container)) {
			// Array iteration
			for (var i = 0; i < container.length; i++) {
				fn.call(scope, i, container[i]);
			}
		}
		else {
			// Hash iteration
			for (var index in container) {
				if (container.hasOwnProperty(index)) {
					fn.call(scope, index, container[index]);
				}
			}
		}
	};
	
	return {
		// @private
		// TODO: Store each <canvas> layer context somewhere
		_buffer: { 'base': [] },
		
		// @private
		_layersQueue: [],
		
		// @private
		// Takes an edge and sets its vertices with the corner objects
		// that represent them, if they exist
		_transformEdge: function (index, edge) {
			if (this.corners[edge.start] && this.corners[edge.end]) {
				var edgeID = this.corners[edge.start].id + '-' + this.corners[edge.end].id;
				edge.start = this.corners[edge.start];
				edge.end = this.corners[edge.end];
				this.edges[edgeID] = edge;
			}
		},
		
		loadedModules: {},
		
		// Load map modules as plugins to the Polygon generator
		load: function (modules, callback) {
			if (typeof modules == 'object') {
				var me = this,
					namespaceMapping = null,
					namespaces = null,
					directoryPrefix,
					moduleNames,
					pathedModules;
					
				if (Array.isArray(modules)) {
					// We only have an array of modules
					moduleNames = modules;
					directoryPrefix = 'modules/';
					pathedModules = modules.map(function (name) { return directoryPrefix + name; });
				}
				else {
					namespaceMapping = {};
					namespaces = [];
					// Modules are namespaced
					pathedModules = [];
					moduleNames = [];
					for (var dir in modules) {
						if (modules.hasOwnProperty(dir)) {
							namespaces.push(dir);
							directoryPrefix = dir + '/';
							pathedModules = pathedModules.concat(modules[dir].map(function (name) {
								namespaceMapping[name] = dir;
								moduleNames.push(name);
								return directoryPrefix + name; 
							}));
						}
					}
				}
				require(pathedModules, function () {
					// Finished loading all modules
					// We need to use the arguments array to dynamically get all module definitions
					var moduleDefs = Array.prototype.slice.call(arguments, 0),
						moduleName,
						layer;
						
					// Attach each loaded module to the Polygons namespaces
					if (namespaceMapping && namespaces) {
						// If the modules were namespaced, we need to add them here
						for (var i = 0; i < namespaces.length; i++) {
							Polygons[namespaces[i]] = {};
						}
					}
					for (var i = 0; i < moduleDefs.length; i++) {
						moduleName = util.capitalize(moduleNames[i]);
						// Load the module into the Polygons namespace
						if (namespaceMapping) {
							// Have to use moduleNames, because moduleName is capitalized
							var namespace = namespaceMapping[moduleNames[i]];
							Polygons[namespace][moduleName] = moduleDefs[i];
						}
						else {
							Polygons[moduleName] = moduleDefs[i];
						}
						// Maintain a reference to the modules that we are using
						me.loadedModules[moduleName.toLowerCase()] = moduleDefs[i];
						// Check if this module defines a layer
						layer = moduleDefs[i].layer;
						if (layer && !me._buffer[layer]) {
							me._buffer[layer] = [];
							// Defer the creation of the <canvas> elements that will house these layers until we can batch them
							me._layersQueue.push(layer);
						}
					}
					
					// Create the canvas elements here
					if (me._layersQueue.length) {
						var doc = document,
							container = doc.getElementById('layers'),
							// Using a document fragment should only trigger one reflow...
							fragment = doc.createDocumentFragment();
						for (var i = 0; i < me._layersQueue.length; i++) {
							var canvas = doc.createElement('canvas');
							canvas.height = 600;
							canvas.width = 1000;
							canvas.id = me._layersQueue[i];
							fragment.appendChild(canvas);
						}
						container.appendChild(fragment);
					}
					
					if (callback) {
						callback();
					}
				});
			}
			else {
				throw new Error('Failed to load Polygons: first argument is not an object.');
			}
		},
		
		generate: function (height, width, pointCount, iterations) {
			// Set base parameters
			this.MapHeight = height;
			this.MapWidth = width;
			
			var boundingBox = { xl: 0, xr: width, yt: 0, yb: height },
				voronoi = new Voronoi();
				
			// Generate a random set of points initially
			var points = [];
			for (var i = 0; i < pointCount; i++) {
				points.push({ x: (Math.floor(Math.random() * width)), y: (Math.floor(Math.random() * height)) });
			}
			
			// Iterate using Lloyd relaxation to get more uniform polygons
			for (var i = 0; i < iterations; i++) {
				var result = voronoi.compute(points, boundingBox);
				// We only need to recompute the centroids if we are going to iterate the polygons again
				if (i + 1 < iterations) {
					// Iterate over the list of cells, and compute the centroid for each one
					points = [];
					var cells = result.cells;
					for (var c = 0; c < cells.length; c++) {
						// The centroid is the euclidean average of the x and y coordinates that make up the polygon
						var edges = cells[c].halfedges,
							xTotal = yTotal = 0;
						for (var e = 0; e < edges.length; e++) {
							var vertex = edges[e].getStartpoint();
							xTotal += vertex.x;
							yTotal += vertex.y;
						}
						// Add the new centroid to the list of anchor points
						points.push({ x: xTotal / edges.length, y: yTotal / edges.length });
					}
				}
			}
			
			var cells = result.cells,
				edges = result.edges;
			// Generate the graph structure to represent the diagram more effectively
			// TODO: Put this in a WebWorker thread and allow binding callbacks to its completion
			// 		 We shouldn't have to delay drawing the graph for this data, but other modules may depend on it
			this.centers = [];
			this.corners = {};
			this.edges = {};
			// Cells are organized by voronoiId, which correspond to their site location
			for (var i = 0; i < edges.length; i++) {
				// Centers
				// ------------------------------
				var leftSite = edges[i].lSite,
					leftCellID = leftSite.voronoiId,
					rightSite = edges[i].rSite,
					rightCellID = rightSite && rightSite.voronoiId;
				// Initialize the center objects if they don't yet exist
				if (!this.centers[leftCellID]) {
					this.centers[leftCellID] = { pos: cells[leftCellID].site, id: leftCellID, neighbors: {}, border: (!rightSite), edges: util.getEdges(cells[leftCellID]) };
				}
				if (rightSite && !this.centers[rightCellID]) {
					this.centers[rightCellID] = { pos: cells[rightCellID].site, id: rightCellID, neighbors: {}, border: false, edges: util.getEdges(cells[rightCellID]) };
				}
				
				// Add the centers as neighbors
				if (rightSite) {
					this.centers[leftCellID].neighbors[rightCellID] = this.centers[rightCellID];
					this.centers[rightCellID].neighbors[leftCellID] = this.centers[leftCellID];
				}
				else {
					this.centers[leftCellID].border = true;
				}
				
				// Corners
				// -----------------------------
				var vertexA = edges[i].va.toString(),
					vertexB = edges[i].vb.toString();
				if (!this.corners[vertexA]) {
					this.corners[vertexA] = { id: vertexA, pos: edges[i].va, adjacent: [], polygons: {} };
				}
				if (!this.corners[vertexB]) {
					this.corners[vertexB] = { id: vertexB, pos: edges[i].vb, adjacent: [], polygons: {} };
				}
				
				this.corners[vertexA].adjacent.push(this.corners[vertexB]);
				this.corners[vertexB].adjacent.push(this.corners[vertexA]);
				// Add the polygons that are adjacent to this corner
				this.corners[vertexA].polygons[leftCellID] = this.centers[leftCellID];
				this.corners[vertexB].polygons[leftCellID] = this.centers[leftCellID];
				// Transform the current polygons edge points from simple vertices to the corners
				iter(this.centers[leftCellID].edges, this, this._transformEdge);
				if (rightSite) {
					this.corners[vertexA].polygons[rightCellID] = this.centers[rightCellID];
					this.corners[vertexB].polygons[rightCellID] = this.centers[rightCellID];
					iter(this.centers[rightCellID].edges, this, this._transformEdge);
				}
			}
			
			return result;
		},
		
		// Buffer up a Drawable type to redraw
		// Drawable types include - polygon, path, and bezierPath
		buffer: function (drawable, layer) {
			this._buffer[layer || 'base'].push(drawable);
		},
		
		// Draws each polygon, based on its stroke and fill
		// If none are provided, then we default to white fill and black stroke
		draw: function (canvas) {
			if (this.centers) {
				this.context = canvas.getContext('2d');
				var polygons = this.centers,
					markedEdges;
				this.context.save();
				iter(polygons, this, function (i, cell) {
					this.context.save();
					markedEdges = [];
					this.context.strokeStyle = cell.stroke || '#000';
					this.context.fillStyle = cell.fill || '#FFF';
					this.context.beginPath();
					for (var i = 0; i < cell.edges.length; i++) {
						var edge = cell.edges[i];
						if (edge.stroke) {
							markedEdges.push(edge);
						}
						this.context.lineTo(edge.start.pos.x << 0, edge.start.pos.y << 0);
						this.context.lineTo(edge.end.pos.x << 0, edge.end.pos.y << 0);
					}
					this.context.closePath();
					this.context.stroke();
					this.context.fill();
					// We need to go over the marked edges now
					for (var i = 0; i < markedEdges.length; i++) {
						var edge = markedEdges[i];
						this.context.strokeStyle = edge.stroke;
						this.context.lineWidth = edge.thickness || 5;
						this.context.beginPath();
						this.context.moveTo(edge.start.pos.x, edge.start.pos.y);
						this.context.lineTo(edge.end.pos.x, edge.end.pos.y);
						this.context.closePath();
						this.context.stroke();
					}
					this.context.restore();
				});
				this.context.restore();
			}
			else {
				// The polygons weren't generated yet
				throw new Error('No polygons have been generated.  Please call Polygons.generate() first.');
			}
		},
		
		getEdge: function (start, end) {
			return Polygons.edges[start.id + '-' + end.id] || Polygons.edges[end.id + '-' + start.id] || null;
		},
		
		hasModule: function (name) {
			return !!this.loadedModules[name];
		}
	};
})();
