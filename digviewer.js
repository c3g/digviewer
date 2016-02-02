/*!
 * DIGViewer 0.1
 * DIGViewer is a grid to navigate through datasets, using multiple metadata dimensions.
 *
 * Copyright 2013-2016 McGill University.
 * Licensed under the LGPL license.
 */

/*jslint browser: true*/
/*global d3, console*/


/**
 * @param {Object} containerDiv Pointer to DOM element
 * @param {Object} userSettings Grid initial configuration parameters
 */
var DIGViewer = function(containerDiv, userSettings) {
    "use strict";

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Constants
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    //Grid positioning and size in SVG canvas
    this.canvas = {
        cell: {
            width: 26,
            height: 26
        },
        row: {
            labelOffset: 140,
            labelWidth: 200
        },
        column: {
            labelOffset: 200,
            labelHeight: 200
        },
        resize: {
            minColumns: 20,             //How many columns should there be in the grid to do a resize?
            cellWidthFactor: 12         //How quickly the grid cell size will reduce, depending on the number of items. Lower number == quicker reducing
        },

        displayBrackets: 1
    };

    this.widthReductionFactor = 0;

    this.row_objects = [];
    this.row_data_field = (userSettings && userSettings.row_data_field) || "row";
    this.row_label_function = (userSettings && userSettings.row_label_function) || function(){};
    this.row_label_decorator = (userSettings && userSettings.row_label_decorator) || new DigViewerLabelDecorator();
    this.row_sort_function = (userSettings && userSettings.row_sort_function) || function(){};
    this.row_label_class_function = (userSettings && userSettings.row_label_class_function) || function(){};

    this.column_objects = [];
    this.column_category_objects = [];
    this.column_data_field = (userSettings && userSettings.column_data_field) || "column";
    this.column_label_function = (userSettings && userSettings.column_label_function) || function(){};
    this.column_label_decorator = (userSettings && userSettings.column_label_decorator) || new DigViewerLabelDecorator();
    this.column_sort_function = (userSettings && userSettings.column_sort_function) || function(){};
    this.column_group_label_function = (userSettings && userSettings.column_group_label_function) || function(){};
    this.column_label_class_function = (userSettings && userSettings.column_label_class_function) || function(){};

    this.y_cat_function = (userSettings && userSettings.y_cat_function) || undefined;

    this.color_objects = [];
    this.colorFunction = (userSettings && userSettings.colorFunction) || function() { return "#AAA"; };

    //User settings and default values
    if ("displayBrackets" in userSettings) { this.canvas.displayBrackets = userSettings.displayBrackets; }      //Display brackets of categories over columns

    //Hooks on specific events
    this.onGridLoaded = (userSettings && userSettings.onGridLoaded) || function(){};
    this.onCellStateChanged = (userSettings && userSettings.onCellStateChanged) || function(){};        //call upon each cell state change arguments : cell datasets, newState
    this.onGridSelectionChanged = (userSettings && userSettings.onGridSelectionChanged) || function(){};

    this.cell_data_property = (userSettings && userSettings.cell_data_property) || "data";
    this.datasetsObj = {};
    this.isMouseDown = false;
    this.selectionMode = undefined;

    var that = this;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Properties
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    this.domContainerDiv = containerDiv;
    this.containerDiv = d3.select(containerDiv);    //User-provided DOM element that contains the DigViewer interface
    this.subContainerDiv = this.containerDiv.append("div");     //To remove all content without removing the main DIV

    var x;
    var y;
    this.matrixWidth = 0;
    this.matrixHeight = 0;

    this.reductionFactor = 0;
    this.initialGridFontSize = 1;      //default font size in em
    this.gridFontSize = 1;      //default font size in em


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Methods
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    /**
     * Renders grid on containing DIV.
     * @param {Object} data Hash of hashes of datasets to be displayed as cells in the grid
     * @param {Array} row_objects
     * @param {Array} column_objects
     * @param {Array} color_objects
     * @param {Array} column_category_objects
     */
    this.drawGrid = function(data, row_objects, column_objects, color_objects, column_category_objects) {
        that.datasetsObj = that._convertData(data);
        that.row_objects = row_objects;
        that.column_objects = column_objects;
        that.color_objects = color_objects;
        that.column_category_objects = column_category_objects;

        //If there's no datasets, just show a text that says so
        if (data.length === 0) {
            that._drawEmptyDatasetMessage();
            that.onGridLoaded();
            return;
        }

        //***************************************************************************************
        // Define the basic parameters and functions for the grid, depeding on number of elements
        //***************************************************************************************
        //Make grid smaller if there's too many elements adjust font size accordingly
        that.widthReductionFactor = 0;
        var gridFontSizeScale = d3.scale.linear();
        gridFontSizeScale.domain([0,30]);
        gridFontSizeScale.range([1,0.6]);

        if (that.column_objects.length >= that.canvas.resize.minColumns) {
            that.widthReductionFactor = (that.column_objects.length / that.canvas.resize.cellWidthFactor) - 1;
        }

        that.reductionFactor = Math.round(that.widthReductionFactor);
        that.gridFontSize = gridFontSizeScale(that.reductionFactor) * this.initialGridFontSize;

        //Determine size of the data grid only (without labels)
        that.matrixWidth = (that.canvas.cell.width - that.widthReductionFactor) * that.column_objects.length;
        that.matrixHeight = (that.canvas.cell.height - that.widthReductionFactor) * that.row_objects.length;


        //***************************************************************************************
        // Define rows and columns sorting using provided functions
        //***************************************************************************************
        //Columns
        x = d3.scale.ordinal()
            .rangeBands([0, that.matrixWidth])
            .domain(that.column_objects.sort(that.column_sort_function).map(function(p){return p.id;}));

        //Rows
        y = d3.scale.ordinal()
            .rangeBands([0, that.matrixHeight])
            .domain(that.row_objects.sort(that.row_sort_function).map(function(p){return p.id;}));


        //****************************************
        // Visualization part
        //****************************************
        //Remove previously drawn elements from the container DIV
        that.subContainerDiv.remove();
        that.subContainerDiv = that.containerDiv.append("div");

        that._drawSvg();
        that._drawRows();
        that._drawColumns();

        //When all the grid processing is over, call global function "onGridLoaded"
        that.onGridLoaded();
    };


//******************************************************************************
// Methods to change cells selection state
//******************************************************************************
    
    /**
     * Selects a single cell selection state.
     * @param {Object} p Grid data object
     * @param {Boolean} newState Grid data object
     */
    this.changeCellState = function(p, newState) {
        p.selected = newState;
        that.onCellStateChanged(p, newState);
    };


    /**
     * Redraw cells selection state based on cell data's "selected" attribute.
     */
    this.refreshCellSelection = function() {
        that.svg.selectAll(".cell").classed("active", function(p) { return p.selected === true; });
    };


    /**
     * Called when a single cell is selected.
     * @param {Object} p Grid cell data object
     */
    this.selectCell = function(p) {
        that.changeCellState(p, !(p.selected));
        that.refreshCellSelection();
        that.onGridSelectionChanged();
    };

    
    /**
     * Selects all cells in one row.
     * @param {Object} p Grid row data object
     */
    this.selectRow = function(p) {
        //First check if all cells in the row are selected
        var allSelected = true;
        for (var i in that.datasetsObj[p.id]) {
            if (that.datasetsObj[p.id].hasOwnProperty(i)) {
                if (!that.datasetsObj[p.id][i].selected) {
                    allSelected = false;
                }
            }
        }
        
        //Only if all cells are selected do we want to deselect everything
        var newState = !allSelected;

        //Change state for all rows
        for (var j in that.datasetsObj[p.id]) {
            if (that.datasetsObj[p.id].hasOwnProperty(j)) {
                that.changeCellState(that.datasetsObj[p.id][j], newState);
            }
        }
        
        that.refreshCellSelection();
        that.onGridSelectionChanged();
      };

    
    /**
     * Selects all cells in one column.
     * @param {Object} colData Grid column data object
     */
    this.selectColumn = function(colData) {
        //First check if all cells in the column are selected
        var allSelected = true;
        that.svg.selectAll(".row").each(function(rowData) {
            if (typeof that.datasetsObj[rowData.id][colData.id] !== "undefined") {
                if ((!that.datasetsObj[rowData.id][colData.id].selected)) { allSelected = false; }
            }
        });
      
        //Deselect everything only if all cells with data are selected
        var newState = !allSelected;
      
        that.svg.selectAll(".row").each(function(rowData) {
            if (typeof that.datasetsObj[rowData.id][colData.id] !== "undefined") {
                that.changeCellState(that.datasetsObj[rowData.id][colData.id], newState);
            }
        });

        that.refreshCellSelection();
        that.onGridSelectionChanged();
    };

    
    /**
     * Selects cells for all columns in one column group.
     * @param {Number} colGroupId ID of the column group to be selected.
     */
    this.selectColumnGroup = function(colGroupId) {
        if (typeof that.y_cat_function === "undefined") {
            return;
        }
        var matchingColumns = that.column_objects.filter(function(currentCol) {return that.y_cat_function(currentCol.id).id.toString() === colGroupId;});

        //First check if all cells in the row are selected
        var allSelected = true;
        that.svg.selectAll(".row").each(function(row) {
            matchingColumns.forEach(function(matchingColumn){
                var currentCell = that.datasetsObj[row.id][matchingColumn.id];
                if (!currentCell.selected) { allSelected = false; }
            });
        });
      
        //Deselect everything only if all cells with data are selected
        var newState = !allSelected;
        
        that.svg.selectAll(".row").each(function(row) {
            matchingColumns.forEach(function(matchingColumn){
                that.changeCellState(that.datasetsObj[row.id][matchingColumn.id], newState);
            });
        });
        
        //Highlight cells
        that.refreshCellSelection();
        that.onGridSelectionChanged();
    };
    
    
    /**
     * Deselects all selected cells.
     */
    this.resetSelection = function() {
        d3.values(that.datasetsObj).forEach(function(p) {
            d3.values(p).forEach(function(q) {
                q.selected = false;
            });
        });

        that.refreshCellSelection();
        that.onGridSelectionChanged();
    };
    
    
    /**
     * Selects all cells in the grid.
     */
    this.selectAll = function() {
        d3.values(that.datasetsObj).forEach(function(p) {
            d3.values(p).forEach(function(q) {
                //q.selected = true;
                that.changeCellState(q, true);
            });
        });
        that.refreshCellSelection();
        that.onGridSelectionChanged();
    };


    /**
     * Get a list of all selected datasets in the grid
     */
    this.getSelectedCells = function() {
        var selectedCells = d3.selectAll(".cell").filter(function (p) { return p.selected; });
        return selectedCells.data();
    };


    /**
     * Order rows by currently assigned sorter.
     * @private
     */
    this.reorderGrid = function() {
        x.domain(that.column_objects.sort(that.column_sort_function).map(function(p){return p.id;}));
        y.domain(that.row_objects.sort(that.row_sort_function).map(function(p){return p.id;}));

        d3.selectAll(".backgroundRow").style("fill", "#FFFFFF");
        that.svg.selectAll(".defs_y").remove();

        var rows_to_move = that.svg.transition().duration(1000).selectAll(".row")
            .delay(function(d) { return that.row_objects.indexOf(d) * 0.5; })
            .attr("transform", function(d) { return "translate(0," + y(d.id) + ")"; });

        that.svg.transition().duration(1000).selectAll(".cell")
            .delay(function(d) { return that.column_objects.indexOf(d) * 0.5; })
            .attr("x", function(d) { return x(d[that.column_data_field]); });

        that.svg.transition().duration(1000).selectAll(".column")
            .delay(function(d) { return that.column_objects.indexOf(d) * 0.5; })
            .attr("transform", function(d) { return "translate(" + x(d.id) + ")rotate(-90)"; });

        //Remove old gradients and create new ones, as needed
        if (that.row_label_decorator.getGradientCount() > 0) {
            for (var i=0; i<that.row_label_decorator.getGradientCount(); i++) {
                that._addGradient("y", i, 0, 0.35);
            }

            rows_to_move.selectAll(".backgroundRow").style("fill", function(p) {
                var gradient = that.row_label_decorator.getGradient(p);
                if (gradient !== null) {return "url(#" + gradient + ")";} else {return "white";}
            });

            for (var j=0; j<that.row_label_decorator.getGradientCount(); j++) {
                var color = (that.row_label_decorator.getGradientColor(j));
                d3.select("#gradient_y_" + j).select("#stop2").transition().delay(1500).duration(1500)
                    .attr("stop-color", color);
            }
        }
    };

//******************************************************************************
// Internal functions
//******************************************************************************

    /**
     * Converts array of dataset objects to a rows hash of column hashes.
     * @param data
     * @returns {{}}
     * @private
     */
    this._convertData = function(data) {
        var newData = {};

        data.forEach(function(d) {
            var rowKey = d[that.row_data_field];
            var colKey = d[that.column_data_field];

            if (typeof newData[rowKey] === "undefined") {
                newData[rowKey] = {};
            }
            if (typeof newData[rowKey][colKey] === "undefined") {
                newData[rowKey][colKey] = d;
            }
            else {
                console.log(data);
                throw Error("Multiple data objects for the same row/column combination: row '" + rowKey + "' col '" + colKey + "'");
            }

        });

        return newData;
    };


    /**
     * Creates the basic SVG elements needed to draw the grid.
     * @private
     */
    this._drawSvg = function() {
        that.svg = that.subContainerDiv.append("svg")
            .attr("width", Math.max((that.matrixWidth + (that.canvas.row.labelWidth * 2)), that.domContainerDiv.offsetWidth-10 ))     //Ensure SVG is always horizontally centered, even if it is small
            .attr("height", Math.max((that.matrixHeight + that.canvas.column.labelHeight + 10), that.domContainerDiv.offsetHeight-10))    //Ensure SVG is always vertically centered, even if it is small
            .on("mouseup",that._clearGridMouseDown)
            .on("mouseleave",that._clearGridMouseDown)
            .append("g")
            .attr("transform", "translate(" + (that.canvas.row.labelWidth * 1.2) + "," + that.canvas.column.labelHeight + ")");

        //Main matrix background rectangle
        var gridBackground = that.svg.append("rect")
            .attr("class", "background cell_border")
            .attr("id", "gridBackground")
            .attr("width", that.matrixWidth)
            .attr("height", that.matrixHeight)
            .attr("pointer-events", "none");
    };


    /**
     * Draws a grid row.
     * @private
     */
    this._drawRows = function() {
        var row = that.svg.selectAll(".row")
            .data(that.row_objects)
            .enter().append("g")
            .attr("class", function (p, q) {
                var clazz = that.row_label_class_function(p, q);
                clazz += " row";
                return clazz;
            })
            .attr("transform", function (d) {
                return "translate(0," + y(d.id) + ")";
            })
            .each(that._drawCells);

        //Horizontal white line between each row
        row.append("line")
            .attr("class", "cell_border")
            .attr("x2", that.matrixWidth)
            .attr("pointer-events", "none");

        //Color-fading background behind row labels
        row.append("rect")
            .attr("x", -200)
            .attr("width", 200)
            .attr("height", that.canvas.cell.height - that.widthReductionFactor)
            .style("fill", "white")
            .attr("class", "backgroundRow");

        //Rows labels
        row.append("text")
            .attr("class", "rtext")
            .attr("x", -6)
            .attr("y", y.rangeBand() / 2)
            .attr("dy", ".32em")
            .attr("text-anchor", "end")
            .text(function (d, i) {
                return that.row_label_function(d, i);
            })
            .attr("style", function () {
                return "font-size:" + that.gridFontSize + "em;";
            })
            .attr("title", function (d, i) {
                return that.row_objects[i].name;
            })
            .on("click", that.selectRow)
            .on("mouseover", that._onRowMouseOver)
            .on("mouseout", that._onRowMouseOut);
    };


    /**
     * Draws grid columns and column categories
     * @private
     */
    this._drawColumns = function() {
        var column = that.svg.selectAll(".column")
            .data(that.column_objects)
            .enter().append("g")
            .attr("class", function(p, q) {var clazz = that.column_label_class_function(p, q); clazz += " column"; return clazz;})
            .attr("transform", function(d) {return "translate(" + x(d.id) + ")rotate(-90)"; });

        //Vertical white line between columns
        column.append("line")
            .attr("class", "cell_border")
            .attr("x1", -(that.matrixHeight))
            .attr("pointer-events", "none");


        //Generate background for column headers
        if (typeof that.column_category_objects !== "undefined") {
            if (that.canvas.displayBrackets) {
                that._drawBrackets(column);
            }

            var sortedColumnGroup = that.column_category_objects.slice(0);
            sortedColumnGroup.sort(function(a, b) {
                return d3.ascending(a.name, b.name);
            });

            for (var i=0; i<sortedColumnGroup.length; i++) {
                that._addGradient("x", sortedColumnGroup[i].id, 1, 0);
                d3.select("#gradient_x_" + sortedColumnGroup[i].id).select("#stop2").attr("stop-color", "#333333");
            }
        }


        column.append("rect")
            .attr("width", 100)
            .attr("height", that.canvas.cell.height - that.widthReductionFactor)
            .style("fill-opacity", function() {
                if (typeof that.y_cat_function === "undefined") {
                    return "0";
                }
            })
            .style("fill", function(p,q){
                if (typeof that.y_cat_function === "undefined") {
                    return "white";
                }
                var gradient = "gradient_x_" + that.y_cat_function(that.column_objects[q].id).id;
                return "url(#" + gradient + ")";
            })
            .attr("class", "backgroundColumn");

        column.append("text")
            .attr("class", "ctext")
            .attr("x", 6)
            .attr("y", x.rangeBand() / 2)
            .attr("text-anchor", "start")
            .text(function(d, i) { return that.column_label_function(d, i); })
            .attr("style", function(){return "font-size:" + that.gridFontSize + "em;";})
            .attr("dy", ".42em")
            .on("click", that.selectColumn)
            .on("mouseover", that._onColMouseOver)
  		    .on("mouseout", that._onColMouseOut);
    };


    /**
     * Draw cells for a grid row.
     * @param row
     * @private
     */
    this._drawCells = function(row) {
        var cellContainer = d3.select(this).selectAll(".cell")
            .data(d3.values(that.datasetsObj[row.id]).filter(function(d) {
                var dataArray = d[that.cell_data_property];
                if (typeof dataArray === "object") {
                    return dataArray.length;
                }
                else {
                    return 0;
                }
            }))
            .enter()
            .append("svg")
            .attr("class", "cell")
            .attr("x", function(d) {
                var keyArr = Object.keys(that.datasetsObj[row.id]);
                var colId = keyArr.find(function(idx){return that.datasetsObj[row.id][idx] === d;});
                return x(colId);
            })
            .on("mouseover", that._onCellMouseOver)
            .on("mouseout", that._onCellMouseOut)
            .on("mousedown",that._onCellMouseDown)
            .on("mouseup",that._clearGridMouseDown);
          
        cellContainer.append("rect")
            .attr("width", x.rangeBand())
            .attr("height", y.rangeBand())
            .style("fill", function(d) { return that.colorFunction(d.institution); });
          
        //Text for a cell, displaying the number of datasets available
        cellContainer.append("text")
            .text(function(d) {
                                var datasetCount = d[that.cell_data_property].reduce(function (p) { return p + 1; }, 0);
                                d.count = datasetCount;
                                return datasetCount;
            })
            .attr("x", function() { return (x.rangeBand()/2); })
            .attr('y', (y.rangeBand()/2))       //Cell text height vertival align
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("width", x.rangeBand())
            .attr("height", y.rangeBand())
            .attr('style', "font-size: " + (that.gridFontSize * 0.8) + "em;")
            .attr('fill', 'black');
    };


    /**
     * Draw brackets regrouping columns by category.
     * @param column
     * @private
     */
    this._drawBrackets = function(column) {
        //Compute coordinates for categories curly brackets
        var minPerCategory = [];
        var maxPerCategory = [];
        column.each(function(p, i) {
            var currentColumn = that.column_objects[i];
            var columnGroupId = that.y_cat_function(currentColumn.id).id;
            var coord = x(p.id);
              
            if (!(columnGroupId in minPerCategory)) {
                minPerCategory[columnGroupId] = coord;
                maxPerCategory[columnGroupId] = coord;
            }
            else if (coord < minPerCategory[columnGroupId]) {
                minPerCategory[columnGroupId] = coord;
            }
            else if (coord > maxPerCategory[columnGroupId]) {
                maxPerCategory[columnGroupId] = coord;
            }
        });
            
        var halfCellWidth = (that.canvas.cell.width - that.reductionFactor) / 2;
        var modfact = 13 - (that.reductionFactor / 2);
        this.svg.selectAll(".bracket")
            .data(Object.keys(minPerCategory))
            .enter().append("g")
            .each(function(p) {
                var column_group = that.y_cat_function(p);
                that._drawCurlyBracket(that.svg, maxPerCategory[p] + halfCellWidth + modfact - 2, -80, minPerCategory[p] - halfCellWidth + modfact + 2, -80);
                that._writeBracketText(that.svg, minPerCategory[p], maxPerCategory[p], 90, halfCellWidth, that.column_group_label_function(column_group), p);
            });
        
        d3.selectAll(".column_category")
            .on("mouseover", that._showColumnColorForGroup)
            .on("mouseout", that._hideColumnGroupColor)
            .on("click", that.selectColumnGroup);
    };
    
    
    /**
     * Highlights current group columns with a gradient.
     * @param colGroupId
     * @private
     */
    this._showColumnColorForGroup = function(colGroupId) {
        d3.selectAll("#gradient_x_" + colGroupId)
            .select("#stop2")
            .transition().duration(200)
            .attr("stop-opacity", 0.35);
    };


    /**
     * Hides the gradient covering all columns.
     * @private
     */
    this._hideColumnGroupColor = function() {
        d3.selectAll(".defs_x")
            .select("#stop2")
            .transition().duration(400)
            .attr("stop-opacity", 0);
    };
    
    
    /**
     * Adds a color gradient to the SVG area.
     * @param axis
     * @param index
     * @param direction Gradient fading direction. 0==fading in, 1==fading out.
     * @param opacity
     * @private
     */
    this._addGradient = function(axis, index, direction, opacity) {
        var left = 100 * direction;
        var right = 100 * (1 - direction);
        
        var gradient = that.svg.append("svg:defs")
          .attr("class", "defs_" + axis)
          .append("svg:linearGradient")
            .attr("id", "gradient_" + axis + "_" + index)
            .attr("x1", left + "%")
            .attr("y1", "0%")
            .attr("x2", right + "%")
            .attr("y2", "0%")
            .attr("spreadMethod", "pad");
        
        gradient.append("svg:stop")
            .attr("id", "stop1")
            .attr("offset", "0%")
            .attr("stop-color", "#FFFFFF")
            .attr("stop-opacity", 0);

        gradient.append("svg:stop")
            .attr("id", "stop2")
            .attr("offset", "100%")
            .attr("stop-color", "#FFFFFF")
            .attr("stop-opacity", opacity);
    };


    /**
     * Event triggered when mouse cursor goes over a cell area.
     * @param p
     * @private
     */
    this._onCellMouseOver = function(p) {
        d3.selectAll(".row .rtext").classed("active", function(d) { return d3.values(that.datasetsObj[d.id]).indexOf(p) !== -1; });  //Returns true if dataObject row has any column with the object p
        d3.selectAll(".column .ctext").classed("active", function(d) {
            for (var r in that.datasetsObj) {
                if (that.datasetsObj.hasOwnProperty(r)){
                    if (that.datasetsObj[r][d.id] === p){
                        return true;
                    }
                }
            }
            return false;
        });

        if(that.isMouseDown){
            that.changeCellState(p, that.selectionMode);
            that.refreshCellSelection();
        }
    };


    /**
     * Event triggered when mouse cursor goes over a cell area.
     * @param p
     * @private
     */
    this._onCellMouseDown = function(p) {
        that.selectionMode = !p.selected;
        that.changeCellState(p, that.selectionMode);
        that.refreshCellSelection();
        that.isMouseDown = true;
    };


    /**
     * Event triggered when mouse cursor leaves a row area.
     * @private
     */
    this._onCellMouseOut = function() {
        d3.selectAll("text").classed("active", false);
    };


    /**
     * Event triggered when mouse cursor goes over a row area.
     * @param p
     * @private
     */
    this._onRowMouseOver = function(p) {
    	d3.selectAll(".row .rtext").classed("active", function(d) { return p.id === d.id; });
    };


    /**
     * Event triggered when mouse cursor leaves a row area.
     * @private
     */
    this._onRowMouseOut = function() {
    	d3.selectAll("text").classed("active", false);
    };


    /**
     * Event triggered when mouse cursor goes over a column area.
     * @param p
     * @private
     */
    this._onColMouseOver = function(p) {
    	d3.selectAll(".column .ctext").classed("active", function(d) { return p.id === d.id; });
    };


    /**
     * Event triggered when mouse cursor leaves a column area.
     * @private
     */
    this._onColMouseOut = function() {
    	d3.selectAll("text").classed("active", false);
    };


    /**
     * Triggered when on mouse up event occurs.
     * @private
     */
    this._clearGridMouseDown = function(){
        if(that.isMouseDown){   //called only if mouseDown event was first triggered on a selectable cell
            that.isMouseDown = false;
            that.onGridSelectionChanged();
        }
    };


    /**
     * Draw a curly bracket at the provided coordinates.
     * Code adapted from https://gist.github.com/alexhornbake/6005176.
     * @param targetElement
     * @param x1
     * @param y1
     * @param x2
     * @param y2
     * @private
     */
    this._drawCurlyBracket = function(targetElement, x1, y1, x2, y2) {
        targetElement.append("path").attr("style", "stroke: #999999; stroke-width: 0.5px; fill: none;").attr("d", function() {
            var w = 8;            //how many pixels wide
            var q = 0.6;        //factor, .5 is normal, higher q = more expressive bracket
            
            //Calculate unit vector
            var dx = x1 - x2;
            var dy = y1 - y2;
            var len = Math.sqrt(dx * dx + dy * dy);
            dx = dx / len;
            dy = dy / len;
    
            //Calculate Control Points of path,
            var qx1 = x1 + q * w * dy;
            var qy1 = y1 - q * w * dx;
            var qx2 = (x1 - 0.25 * len * dx) + (1 - q) * w * dy;
            var qy2 = (y1 - 0.25 * len * dy) - (1 - q) * w * dx;
            var tx1 = (x1 - 0.5 * len * dx) + w * dy;
            var ty1 = (y1 - 0.5 * len * dy) - w * dx;
            var qx3 = x2 + q * w * dy;
            var qy3 = y2 - q * w * dx;
            var qx4 = (x1 - 0.75 * len * dx) + (1 - q) * w * dy;
            var qy4 = (y1 - 0.75 * len * dy) - (1 - q) * w * dx;
    
            //Returns path for a curly brace between x1,y1 and x2,y2
            return ("M " + x1 + " " + y1 + " Q " + qx1 + " " + qy1 + " " +
                    qx2 + " " + qy2 + " T " + tx1 + " " + ty1 + " M " +
                    x2 + " " + y2 + " Q " + qx3 + " " + qy3 + " " + qx4 +
                    " " + qy4 + " T " + tx1 + " " + ty1);
        });
    };


    /**
     * Draw text over the curly bracket at the provided coordinates.
     * @param targetElement
     * @param xMin
     * @param xMax
     * @param y
     * @param halfCellWidth
     * @param text
     * @param data
     * @private
     */
    this._writeBracketText = function(targetElement, xMin, xMax, y, halfCellWidth, text, data) {
        var len = (xMax - xMin) / 2;
        targetElement.append("text")
            .data(data)
            .attr("class", "column_category")
            .attr("style", "fill: #AAAAAA;")
            .attr("x", y)
            .attr("dy", ".32em")
            .text(text)
            .attr("transform", function() { return "translate(" + (xMin + len + halfCellWidth) + ")rotate(-90)"; });
    };


    /**
     * Replace SVG grid with message saying there's no datasets available.
     * @private
     */
    this._drawEmptyDatasetMessage = function() {
        //If anything was previously drawn
        that.subContainerDiv.remove();
        that.subContainerDiv = that.containerDiv.append("div");
        that.subContainerDiv.attr("style", "display:flex; justify-content:center; width:100%; height:100%;");

        that.subContainerDiv
            .append("div").attr("id", "noDatasetsMessageDiv")
            .attr("style", "align-self: center; font-size: large;")
            .append("span").attr("id", "noDatasetsMessageSpan")
            .text("No datasets available for the current settings!");
    };
};


var DigViewerLabelDecorator = function() {
    "use strict";

    this.getGradientCount = function() {return 1;};
    this.getGradient = function() { };
    this.getGradientColor = function() { };

};