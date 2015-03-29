var app = angular.module('app', []);

var cache_buildTable = false;
app.filter('buildTable', function() {
    return function(paths, path) {
    	if(!cache_buildTable)
    		cache_buildTable = getNewCanvas();
    	for(var i in cache_buildTable)
    		for(var j in cache_buildTable[i])
    			cache_buildTable[i][j] = 0;
    	if(!paths)
    		return cache_buildTable;
    	for(var i in paths)
    		for(var j in paths[i]){
    			var pos = paths[i][j];
    			if(pos.hasOwnProperty('x')){
	    			// console.log(paths[i][j], path);
	    			cache_buildTable[pos.x][pos.y] = 1+(paths[i]==path);
	    		}
    		}
        return cache_buildTable;
    };
});

function getNewCanvas(){
	var C = new Array();
	for(var i in SC.data){
		var o = new Array();
		for(var j in SC.data[0])
			o.push(false);
		C.push(o);
	}
	return C;
}
function buildTable(w, h, oData){
	var C = new Array();
	for(var i=0; i<w; i++){
		var o = new Array();
		for(var j=0; j<h; j++)
			o.push((oData && oData[i] && oData[i][j])?oData[i][j]:0);
		C.push(o);
	}
	return C;
}

function isSamePoint(A, B){
	return ((+A.x)==(+B.x))&&((+A.y)==(+B.y));
}

function clone(obj) {
    if(obj == null || typeof(obj) != 'object')
        return obj;

    var temp = obj.constructor(); // changed

    for(var key in obj) {
        if(obj.hasOwnProperty(key)) {
            temp[key] = clone(obj[key]);
        }
    }
    return temp;
}

function classifyValues(givenData){
	var byNum = {};
	
	for(var i in givenData)
		for(var j in givenData[i])
			if(!byNum[givenData[i][j]])
				byNum[givenData[i][j]] = {coords: new Array({x:+i, y:+j})};
			else
				byNum[givenData[i][j]].coords.push({x:+i, y:+j});

	// We don't care about '0' field
	delete byNum[0];
	delete byNum[''];

	return byNum;
}


function process(givenData){
	var byNum = classifyValues(givenData);

	for(var l in byNum){
		if(byNum[l].coords.length%2!=0)
			throw "Nombre impaire d'un certain marqueur.";
		
		byNum[l].possibilities = new Array();
		populateConformations = function(points, currentConf){
			if(points.length==0)
				byNum[l].possibilities.push(currentConf);
			else
				for(var i in points)
					for(var j=i+1; j<points.length; j++)
						if(j!=i)
							(function(){
								var points_bis = clone(points);
								var conf = clone(currentConf);
								conf.push([points_bis.splice(i, 1)[0], points_bis.splice(j-1, 1)[0]]);
								populateConformations(points_bis, conf);
							})();
		}

		populateConformations(clone(byNum[l].coords), []);
	}

	var allPossibilities = new Array();

	function populate(possible, whatNext){
		var current;
		if(whatNext.length==0)
			return allPossibilities.push(possible);
		byNum[current = whatNext.shift()].possibilities.forEach(function(couples){
			// console.log('HERE', +current, couples);
			var currentPossible = clone(possible);
			currentPossible.push({couples: couples, length: +current});
			populate(currentPossible, clone(whatNext));
		});
	}

	var keys = [];
	for(var k in byNum) keys.push(+k);

	populate([], keys);

	SC.results = [];

	function evaluateThisPossibility(P, canvas, path, paths){
		while(P[0] && P[0].couples.length==0)
			P.shift();

		if(P.length==0){
			SC.results.push({paths: paths, canvas: canvas});
			return true;
		}
		if(!canvas)
			canvas = getNewCanvas();
		if(!path)
			path = new Array();
		if(!paths)
			paths = new Array();

		var linkToDo = {length: P[0].length, couple: P[0].couples.shift()};



		var dest = linkToDo.couple[1];
		path.push(clone(linkToDo.couple[0]));
		var current = {
			pos: linkToDo.couple[0],
			length: linkToDo.length
		};

		if(current.pos.x<0 || current.pos.y<0)
			return false;
		if(current.pos.x>canvas.length-1 || current.pos.y>canvas[0].length-1)
			return false;

		if(canvas[current.pos.x][current.pos.y])//On ne peut pas passer par là !
			return false;
		canvas[current.pos.x][current.pos.y] = true;


		if(isSamePoint(dest, current.pos)){
			if(current.length!=1)
				return false;
			paths.push(path);
			evaluateThisPossibility(P, canvas, null, paths);
			return true;
		}

		var goThisWay = function(dX, dY){
			var myPos = {x: current.pos.x+dX, y: current.pos.y+dY};
			var newP = clone(P);
			newP.unshift({couples: [[myPos, dest]], length: current.length-1});
			evaluateThisPossibility(newP, clone(canvas), clone(path), clone(paths));
		}

		var delta = 1+Math.abs(current.pos.x-dest.x)+Math.abs(current.pos.y-dest.y);
		if(delta%2!=current.length%2 || delta>current.length)//Impossible
			return false;
		else{//On teste tout ce que l'on peut
			goThisWay(1, 0);
			goThisWay(-1, 0);
			goThisWay(0, 1);
			goThisWay(0, -1);
		}
	}

	for(var i in allPossibilities)
		evaluateThisPossibility(allPossibilities[i]);

	SC.stepOne = false;
	SC.selResult = SC.results[0];
	SC.PATH_SEL = SC.results[0].paths[0];
}

var SC;

var originalData = [
		[0, 4, 0, 5, 0, 0],
		[0, 6, 0, 5, 5, 0],
		[0, 0, 4, 0, 0, 0],
		[3, 0, 6, 0, 0, 0],
		[0, 0, 0, 0, 0, 0],
		[3, 0, 0, 5, 0, 0],
	];

app.controller('ctrl', function($scope, $parse) {
	$scope.stepOne = true;
	SC = $scope;
	$scope.process = process;
	$scope.currentSize = [6, 6];
	
	$scope.resize = function(w, h){
		$scope.data = buildTable(w, h, $scope.data || originalData);
	};
	$scope.empty = function(){
		for(var i in $scope.data)
			for(var j in $scope.data[i])
				$scope.data[i][j] = 0;
	};
	$scope.$watch('currentSize', function(){
		$scope.resize($scope.currentSize[0], $scope.currentSize[1]);
	}, true);

	$scope.selResult = null;
	$scope.PATH_SEL = "none";
	
	$scope.JSON = JSON;
});