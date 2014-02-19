/**
## Cap Mixin

Cap is a mixin that groups small data elements below a _cap_ into an *others* grouping for both the Row and Pie Charts.

The top ordered elements in the group up to the cap amount will be kept in the chart and
the sum of those below will be added to the *others* element. The keys of the elements below the cap limit are recorded
in order to repsond to onClick events and trigger filtering of all the within that grouping.

**/
dc.capMixin = function (_chart) {

    var _cap = Infinity;

    var _othersLabel = "Others";

    var _othersGrouper = function (otherRows) {
        var otherRowsSum = d3.sum(otherRows, _chart.valueAccessor()),
            others = otherRows.map(_chart.keyAccessor());
        return {"others": others, "key": _othersLabel, "value": otherRowsSum};
    };

    _chart.cappedKeyAccessor = function(d,i) {
        if (d.others)
            return d.key;
        return _chart.keyAccessor()(d,i);
    };

    _chart.cappedValueAccessor = function(d,i) {
        if (d.others)
            return d.value;
        return _chart.valueAccessor()(d,i);
    };
    
    var _capGroup = {
        all: function() {
            if (_cap == Infinity) {
        	return _capGroup.group.all();
            }
            var top = _capGroup.group.top(_cap);
            var getKey = _chart.keyAccessor();
            var topSet = d3.set(top.map(getKey));
            var others = _capGroup.group.all()
        	.filter(function(d){
        	    return !topSet.has(getKey(d));
        	});
            if (others.length) {
        	top.others = _othersGrouper(others);
            }
            return top;
        },
    };
    function capGroup(g,n) {
        if (!arguments.length) return _capGroup;
        _capGroup.group = g;
        return capGroup.overridden(_capGroup,n);
    };
    dc.override(_chart, 'group', capGroup);

    function capData(callback) {
    	if (arguments.length) return capData.overridden(callback);
    	var data = capData.overridden();
    	if (data.others) {
    	    data.push(data.others);
    	}
    	return data;
    }
    dc.override(_chart, 'data', capData);
    
    /**
    #### .cap([count])
    Get or set the count of elements to that will be included in the cap.
    **/
    _chart.cap = function (_) {
        if (!arguments.length) return _cap;
        _cap = _;
        return _chart;
    };

    /**
    #### .othersLabel([label])
    Get or set the label for *Others* slice when slices cap is specified. Default label is **Others**.
    **/
    _chart.othersLabel = function (_) {
        if (!arguments.length) return _othersLabel;
        _othersLabel = _;
        return _chart;
    };

    /**
    #### .othersGrouper([grouperFunction])
    Get or set the grouper function that will perform the insertion of data for the *Others* slice if the slices cap is
    specified. If set to a falsy value, no others will be added. By default the grouper function computes the sum of all
    values below the cap.
    ```js
    chart.othersGrouper(function (data) {
        // compute the value for others, presumably the sum of all values below the cap
        var othersSum  = yourComputeOthersValueLogic(data)

        // the keys are needed to properly filter when the others element is clicked
        var othersKeys = yourComputeOthersKeysArrayLogic(data);

        // add the others row to the dataset
        data.push({"key": "Others", "value": othersSum, "others": othersKeys });

        return data;
    });
    ```
    **/
    _chart.othersGrouper = function (_) {
        if (!arguments.length) return _othersGrouper;
        _othersGrouper = _;
        return _chart;
    };

    dc.override(_chart, "onClick", function (d) {
        if (d.others)
            _chart.filter([d.others]);
        _chart._onClick(d);
    });

    return _chart;
};
