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

    var _othersGrouper = function (group, otherRows) {
        var others = otherRows.map(_chart.keyAccessor()),
            otherData = otherRows.map(_chart._dataAccessor()),
            otherValue = _chart._apply()(_othersOut, otherData);
        return {"others": others, "key": _othersLabel, "value": otherValue};
    };

    var _othersOut = function (data) {
        return data;
    };

    function _capKeyAccessor(d,i) {
        if (d.others)
            return d.key;
        return capKeyAccessor.overridden()(d,i);
    };
    function capKeyAccessor(d,i) {
        if (!arguments.length) return _capKeyAccessor;
        return capKeyAccessor.overridden(d,i);
    };
    dc.override(_chart, 'keyAccessor', capKeyAccessor);

    function _capValueAccessor(d,i) {
        var getVal = capValueAccessor.overridden();
        if (d.others)
            return getVal(d.value);
        return getVal(d,i);
    };
    function capValueAccessor(d,i) {
        if (!arguments.length) return _capValueAccessor;
        return capValueAccessor.overridden(d,i);
    };
    dc.override(_chart, 'valueAccessor', capValueAccessor);
    
    var _capDataAccessor = function(d) {
        var getData = capDataAccessor.overridden();
        if (d.others)
            return getData(d.value);
        return getData(d);
    };
    function capDataAccessor(f) {
        if (!arguments.length) return _capDataAccessor;
        return capDataAccessor.overridden(f);
    }
    dc.override(_chart, '_dataAccessor', capDataAccessor);

    var _capClientDataAccessor = function(d) {
        var getData = capClientDataAccessor.overridden();
        if (d.others)
            return getData(d.value);
        return getData(d);
    };
    function capClientDataAccessor(f) {
        if (!arguments.length) return _capClientDataAccessor;
        return capClientDataAccessor.overridden(f);
    }
    dc.override(_chart, '_clientDataAccessor', capClientDataAccessor);

    var _capGroup = {
        all: function() {
            var group = capGroup.overridden();
            if (_cap == Infinity) {
                return _chart._computeOrderedGroups(group.all());
            }
            var top = _chart._computeOrderedGroups(group.top(_cap));
            var getKey = _chart.keyAccessor();
            var topSet = d3.set(top.map(getKey));
            var others = capGroup.overridden().all()
                .filter(function(d){
                    return !topSet.has(getKey(d));
                });
            if (others.length) {
                top.push(_othersGrouper(group, others));
            }
            return top;
        },
    };
    function capGroup(g,n) {
        if (!arguments.length) return _capGroup;
        return capGroup.overridden(g,n);
    };
    dc.override(_chart, 'group', capGroup);
    
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

    /**
    #### .othersOut([outFunction])
    Get or set the function that will reconstruct an *Others* instance of the input data from the set of values below the cap.
    By default the out function records all the values below the cap.
    **/
    _chart.othersOut = function (_) {
        if (!arguments.length) return _othersOut;
        _othersOut = _;
        return _chart;
    };

    dc.override(_chart, "onClick", function (d) {
        if (d.others)
            _chart.filter([d.others]);
        _chart._onClick(d);
    });

    return _chart;
};
