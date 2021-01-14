// Constants for the whole page
const margins = {top:10, bottom:60, left:90, right:20};
const width = 800;
const height = 600;

// Data for vis1 (squares) --------------------
const deathsbygender = {Total:1233,Male:905,Female:328}
const deathsbyrace = { White: 996, Black: 58, Asian: 12, Hispanic: 143, Other: 24}
const deathsbyage = {"<15": 0, "15-24": 67, "25-34": 396,"35-44": 314,
  "45-54": 263, "55-64": 160, "65+": 33, "Unknown": 0}
  // Reshape data for easier visualization on grid
const genderAsList = []
for(i=0; i < deathsbygender.Male; i++){genderAsList.push("M")}
for(i=0; i < deathsbygender.Female; i++){genderAsList.push("F")}

const ageAsList = []
const age_keys = Object.keys(deathsbyage);
for(i=0; i < age_keys.length; i++){
  let current_key = age_keys[i];
  for(j=0; j < deathsbyage[current_key]; j++){
    ageAsList.push(current_key);
  }
}

const raceAsList = [];
const race_keys = Object.keys(deathsbyrace);
for(i=0; i < race_keys.length; i++){
  let current_key = race_keys[i];
  for(j=0; j < deathsbyrace[current_key]; j++){
    raceAsList.push(current_key);
  }
}

const vis1_array = []
for(i=0; i <genderAsList.length; i++){
  vis1_array.push([genderAsList[i], raceAsList[i], ageAsList[i]]);
}
//-----------END Vis 1 grid data

// Constants for sizing the town line plot
const town_width = 250;
const town_height = 250;

// Constants for sizing prescriptions scatterplot
const scatter_width = 400;
const scatter_height = 400;

// Load data
Promise.all([
d3.csv("county_deaths.csv"),
d3.csv("city_deaths.csv"),
d3.json("mass_counties.json"),
d3.json("mass_towns.json")
]).then(function(data){

    // Data assignments
    const county_data = data[0];
    const town_data = data[1];
    const county_map_data = data[2];
    const town_map_data = data[3];

// MAP =====================================================
    // Set up map
    const chart4 = d3.select("#vis4")
        .attr("width", 1200) // Large width forces map to the left
        .attr("height", height + margins.top + margins.bottom);

    const map = chart4.append("g")
        .attr("transform", `translate(${margins.left}, ${margins.top})`);

    // create projection to map from lat,lon data to x,y, coordinates
    // Center on Massachusetts
    const projection = d3.geoAlbers()
        .scale( 19000 )
        .rotate( [71.057,0] )
        .center( [-0.5, 41.95] )
        .translate( [width/2,height/2] );

    //create path tool to translate GeoJSON into SVG path data
    const mapPath = d3.geoPath().projection(projection);

    //create coloring tool
    const color_scale_map = d3.scaleQuantize()
        .range(colorbrewer.YlGnBu[8]);

    //convert map data from TopoJSON to GeoJSON
    const ma_counties = topojson.feature(county_map_data, county_map_data.objects.mass_counties);
    const ma_towns = topojson.feature(town_map_data, town_map_data.objects.ma_towns);

    // set domain of map color scale (used for both county and town choropleth)
    // Min value set to account for lower min value of town-level data without overly simplifying county level map
    color_scale_map.domain([.0009, d3.max(county_data, (d) => +d["TotalDeathsPerCapita"])]);

    // nest the county level data
    let countyData = d3.nest()
        .key((d) => d.County)
        .entries(county_data);

    //single nest the town level data (for town plot)
    let townData = d3.nest()
        .key((d) => d.County)
        .entries(town_data);

    // double nest the town level data (for town map)
    let townData2 = d3.nest()
        .key((d) => d.City)
        .entries(town_data)

    // map countyData, so we can easily find records for a given county
    const county_map = d3.map();
    countyData.forEach((d) => {county_map.set(d.values[0].County, d.values[0])});

    //Loop through the path data, attach appropriate record to each one
    for (let i = 0; i < ma_counties.features.length; i++) {
      let name = ma_counties.features[i].properties.NAME;
      ma_counties.features[i].properties.value = county_map.get(name);
    }

    //Add county-layer to map
    map.append("g")
        .attr("id", "county-layer");
    //Add town layer to map
    map.append("g")
        .attr("id", "town-layer")

    // Add county borders to county-layer g
    const counties = d3.select("#county-layer")
        .selectAll(".county-borders")
        .data(ma_counties.features, (d) => d)
        .enter()
        .append("path")
        .attr("d", mapPath)
        .attr("id", (d) => d.properties.NAME)
        .attr("class", "county-borders");

    //style each county to set fill color based on deaths per capita
    counties.style("stroke", "white")
        .style("fill", function(d) {
          if (d.properties.value) {
            return color_scale_map(+d.properties.value["TotalDeathsPerCapita"]);
          } else{
            return "red";
          }
        });

      // map townData, so we can easily find records for a given town
      const town_map = d3.map();
      townData2.forEach((d) => {town_map.set(d.values[0].City, d.values[0])});

      //Loop through the path data, attach appropriate record to each one
      for (let i = 0; i < ma_towns.features.length; i++) {
        let town_name = ma_towns.features[i].properties.TOWN;

        if(town_name.includes(" ")){
          let space_index = town_name.indexOf(" ");
          town_name = town_name.slice(0,1) +
              town_name.slice(1, space_index).toLowerCase() + " " +
               town_name.slice(space_index + 1, space_index + 2) +
               town_name.slice(space_index +2, town_name.length).toLowerCase();
        } else {
        town_name = town_name.slice(0,1) + town_name.slice(1, town_name.length).toLowerCase();
        }
        ma_towns.features[i].properties.value = town_map.get(town_name);
      };


    //event handlers for map
    counties.on("mouseover", function(d){
      const coordinates = [d3.event.pageX, d3.event.pageY];

      d3.select("#mapTooltip")
        .style("left", (coordinates[0]+25) + "px")
        .style("top", (coordinates[1]+10) + "px")
        .classed("hidden", false);

      d3.select(this).style("fill-opacity", .7)

      d3.select("#countyname").text(d.properties.value.County);
      d3.select("#deaths").text(+d.properties.value.TotalDeathsAllYears);
    });

    counties.on("mouseout", function(d) {
      d3.select("#mapTooltip").classed("hidden", true)
      d3.selectAll(".county-borders").style("fill-opacity", 1);
    });

    // Clicking a county on the map updates the line plot, county and town map layers
    counties.on("click", function(item_data) {
      selected_county = item_data.properties.NAME;
      update_town_vis();
      update_county_map(selected_county);
      update_town_map(selected_county);
    });


    /*
      Updates county map to make selected county gray.
      Called by click event handler for counties
    */
    const update_county_map = function(selected_county) {

      d3.selectAll(".county-borders")
        .style("fill", function(d) {
          if (d.properties.value) {
            return color_scale_map(+d.properties.value["TotalDeathsPerCapita"]);
          } else{
            return "red";
          }
        });

      d3.select("#" + selected_county )
        .style("fill", "lightgray");

    };


    /*
      Update town-layer to show towns for selected county.
      Called by click event handler for counties
    */
    const update_town_map = function(selected_county) {

      let selected_towns_data = ma_towns.features.filter( function(d) {

        if (d.properties.value) {
        return d.properties.value.County == selected_county;
        } else {
        return false
      }

      })

      // Enter/exit/update for Towns
      let towns = d3.select("#town-layer").selectAll(".town-borders")
          .data(selected_towns_data, (d) => d)

       towns.exit().remove();

      let new_towns = towns.enter()
                 .append("path")
                 .attr("d", mapPath)
                 .attr("class", "town-borders")

        towns = towns.merge(new_towns);

        towns.style("stroke", "lightgray")
          .style("stroke-width", 0.5)
          .style("fill", function(d) {
            if (d.properties.value && d.properties.value["TotalDeathsPerCapita"] !== "NA") {
              return color_scale_map(+d.properties.value["TotalDeathsPerCapita"]);
            } else{
              return "lightgray";
            }
          });


    };



// ========================================================= END MAP

// Prescriptions ===========================================

    // Prescriptions Scatterplot sizing and axis
    const chart3 = d3.select("#vis3")
        .attr("width", scatter_width + margins.right + margins.left)
        .attr("height", scatter_height + margins.top + margins.bottom);

    const scatterplot = chart3.append("g")
        .attr("transform", `translate(${margins.left}, ${margins.top})`);

    scatterplot.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `translate(${scatter_width/2}, ${scatter_height+margins.bottom-10})`)
      .text("Schedule II Opioid Prescriptions (Total, 2013 - 2017)");

    scatterplot.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `translate(${-(margins.left/1.5)}, ${scatter_height/2})rotate(-90)`)
      .text("Opioid Related Deaths (Total, 2013-2017)");

    // x and y scales for chart3 (prescription scatterplot)
    const x_scale = d3.scaleLinear()
        .range([0, scatter_width])
        .domain([0, d3.max(countyData, (d) => +d.values[0].TotalPrescriptions)]);

    const y_scale = d3.scaleLinear()
         .range([scatter_height, 0])
         .domain([0, d3.max(countyData, (d) => +d.values[0].TotalDeathsAllYears)]);

    const x_axis = scatterplot.append("g")
        .attr("transform", `translate(0, ${scatter_height})`)
        .call(d3.axisBottom(x_scale));

    const y_axis = scatterplot.append("g")
        .call(d3.axisLeft(y_scale));

    //Create scatterplot points, bind nested countyData
    let points = scatterplot.selectAll(".newPoints")
        .data(countyData, (d) => d)
        .enter()
        .append("circle")
        .attr("class", "newPoints")
        .attr("cx", (d) => x_scale(+d.values[0].TotalPrescriptions))
        .attr("cy", (d) => y_scale(+d.values[0].TotalDeathsAllYears))
        .attr("r", 4)
        .style("fill", color_scale_map(.0025));

    points.on("mouseover", function(d){
      const coordinates = [d3.event.pageX, d3.event.pageY];

    d3.select("#tooltip")
        .style("left", (coordinates[0]+25) + "px")
        .style("top", (coordinates[1]+10) + "px")
        .classed("hidden", false);

    d3.select("#countyname_tooltip").text(d.key);
    d3.select("#prescriptions_tooltip").text(d.values[0].TotalPrescriptions);
    d3.select("#deaths_tooltip").text(d.values[0].TotalDeathsAllYears);

    });

    points.on("mouseout", function(d) {
      d3.select("#tooltip").classed("hidden", true)
    });

     // Add regression line to scatterplot
     // y = (.03156)x - 100.1
    scatterplot.append("line")
        .attr("x1", x_scale(0))
        .attr("x2", x_scale(91295))
        .attr("y1", y_scale(-100.1))
        .attr("y2", y_scale(.03156 * 91295 - 100.1))
        .style("stroke", "lightgray")

// ======================================================= END Prescriptions

// TOWN PLOT (Interacts with County Map)===================================
    const town_plot = chart4.append("g")
      .attr("transform", `translate(150, 350)`);

    const x_scale_town = d3.scaleLinear()
      .range([0, town_width])
      .domain([2013, 2017])

    const y_scale_town = d3.scaleLinear()
      .range([town_height, 0])

    town_plot.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `translate(${town_width/2}, ${town_height+margins.bottom-10})`)
      .text("Year");

    town_plot.append("text")
      .attr("text-anchor", "middle")
      .attr("transform", `translate(${-(margins.left/1.5)}, ${town_height/2})rotate(-90)`)
      .text("Deaths per Capita");

    town_plot.append("g")
       .attr("transform", `translate(0, ${town_height})`)
       .call(d3.axisBottom(x_scale_town).tickFormat(d3.format("d")))

    let ybar=town_plot.append("g")
       .call(d3.axisLeft(y_scale_town));

    let town_plot_title = town_plot.append("text")
          .attr("text-anchor", "middle")
          .attr("transform", `translate(${town_width/2}, -10)`)
           .text("");



    /**
      Updates line plot of DeathsPerCapita over Time by town based on user selected county.
      Called by click event handler for map
    **/
    const update_town_vis = function() {
      let names2=[];

      // Filter townData to just the selected_county
      let filtered_town_data = townData.filter((d) => d.key == selected_county)[0].values

      const data = d3.nest()
        .key(function(d) { return d.City; })
        .map(filtered_town_data);

      let cities = data.keys();

      for (i=0; i<data.size(); i++){
        const name = cities[i];
        const selected = data.get(name);
        const name_obj = {name:name, data:selected, color: null};
        names2.push(name_obj)
      }
      // console.log("names2",names2)
      function find_max(){
        max=0;
        for (name=0; name<names2.length; name++){
          let data=names2[name].data;
          for (year=0; year<data.length; year++){
              let tyear=data[year];
              let dperCap=+tyear.DeathsPerCapita;

              if (max<dperCap){

                max=dperCap;
              }


          }
        }
        return max;
      }
      let themax=find_max();

      y_scale_town.domain([0, themax]);


      // y_scale_town.domain(d3.extent(names2, (d)=>d.data[0]["DeathsPerCapita"]))
      ybar.call(d3.axisLeft(y_scale_town));

      // let color_scale_townlines= d3.scaleQuantize()
      //   .domain(d3.extent(names2, (d, i)=>(i)))
      //   .range(colorbrewer.YlGnBu[8]);

    let color_scale_townlines=['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','gray','#bc80bd','#ccebc5','#ffed6f', '#fb9a99', '#a6cee3', 'black'];


      const line = d3.line()
        .x((d) => x_scale_town(+d["Year"]))
        .y((d) => y_scale_town(+d["DeathsPerCapita"]));

        //current set
      let current=town_plot.selectAll(".namelines2")
          .data(names2, (d)=>d)

        //exit set
      current.exit().remove();

        //enter set
      let new_lines=current.enter()
            .append("path")
            .attr("class", "namelines2")
            .on('mouseover', function(d){

              const tooltip=d3.select("#tooltipCityMap");

              tooltip.classed("hidden", false);

              d3.select("#name").text(d.name);
              d3.select("#pop").text(+d.data[0]["Population"]);


              const coordinates = [d3.event.pageX, d3.event.pageY];

              tooltip.style("left", (coordinates[0]+25) + "px");
              tooltip.style("top", (coordinates[1]+25) + "px");


            })
            .on('mouseout', function(d){
              const tooltip=d3.select("#tooltipCityMap");
              tooltip.classed("hidden", true);
            })


      current=current.merge(new_lines);

      current.attr("d", function(d,i){

          return line(d.data);
      })
      .style("stroke", function(d,i){
        return color_scale_townlines[i]})
      .style("fill", "none")
      .attr('stroke-width', function(d) {


            return 2;


       })

      town_plot_title.text("Towns in " + String(selected_county) + " County")

    };

// ============================================ END TOWN PLOT


// Vis 1 Grid of Demographics ====================================
    //Constants for sizing
    const vis1_width = 300;
    const vis1_height = 300;
    const gridSize = 8;
    const numPerRow=Math.floor(vis1_width/gridSize)

    //Scale
    const grid_scale = d3.scaleLinear()
    .domain([0, numPerRow -1])
    .range([0, gridSize * numPerRow])

    d3.select('#vis1').attr("width", vis1_width + 10).attr("height", vis1_height)
    let current = d3.select("#vis1").selectAll(".death_rect")
      .data(vis1_array)

    let enter_set=current.enter()

    enter_set.append("rect")
      .attr("class", "death_rect")
      .attr('x', (d, i) => {
        const n = i % numPerRow
        return grid_scale(n)
      })

      .attr('y', (d, i) => {
        const n = Math.floor(i / numPerRow)+2 // <-D
        return grid_scale(n)
      })
      .attr("height", gridSize+"px")
      .attr("width", gridSize+"px")
      .style("fill", "lightgray")
      .attr("stroke", "white")
      .attr("stroke-width", "1")

    // color functions for squares
    const gridColors = {
      "M": "blue",
      "F":"pink",
      "White": "#bababa",
      "Black": "#404040",
      "Asian": "#f4a582",
      "Hispanic": "#ca0020",
      "Other": "pink",
      "15-24": "#fef0d9",
      "25-34": "#fdd49e",
      "35-44": "#fdbb84",
      "45-54": "#fc8d59",
      "55-64": "#e34a33",
      "65+": "#e34a33"
    }

    const updateGridColors = function(index){
      d3.selectAll('.death_rect')
        .transition().duration(2000)
        .style("fill", (d) => gridColors[d[index]]);//.style
    }//updateGridColors

    const gridCaptions = [
      // "Between January and September of 2018, there were <b>1,233</b> opioid-related overdose deaths." +
      // "( <span style='background-color: lightgray;'>&nbsp; &nbsp;&nbsp;</span>"+
      // "1 square = 1 death <span style='width:10px;'></span>) <br>" +
      // "Click through to explore the demographic breakdown",

      //Gender
      "<span style='color: blue;'> 73% </span> of the victims of deadly overdoses were <span style='color: blue;'> male,</span>" +
      " while the remaining <span style='color: pink;'>27%</span> were <span style='color: pink;'>female.</span> <br><br>" +
      " <span style='background-color: blue;'>&nbsp; &nbsp;&nbsp;</span> Male" +
      " <span style='background-color: pink;'>&nbsp; &nbsp;&nbsp;</span> Female",

      //Race
      // white non-hispanic: 81% of deaths, 72% of population
      // Hispanic: < 1 % but 7% of population
      // Black: 4% but 8.8% of population
      "Looking at the breakdown by race, we can see that this is affecting white males the most. "+
      "While 72.1% of Massachusetts residents are White (Non-Hispanic), "+
      "<span style='color:" + gridColors["White"] + "'> <b>81% of opioid overdose victims</b></span> are white. <br>" +
      "Compare this to <span style='color:" + gridColors["Asian"] + "'><b>Asian</b></span>, who make up 7% of the MA population but less than 1% of opioid deaths. <br><br>" +
      " <span style='background-color:" + gridColors["White"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " White &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["Black"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " Black &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["Asian"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " Asian &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["Hispanic"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " Hispanic &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["Other"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " Other/Unknown &nbsp;&nbsp;",
      // Age
      "We can also see the age of these victims is relatively spread, although those under 24 and over 55 are affected less often. " +
      "However, it is important to note the implications of these numbers. <br><br>"+
      "<b>58%</b> of all deaths of Massachusetts residents between the ages of"+"<span style='color:" + gridColors["25-34"] + "'>  <b>25</b></span>" +
      " and <span style='color:" + gridColors["35-44"] + "'><b>44</b></span> were caused by opioids, " +
      "compared to <b>34%</b> for those aged"+"<span style='color:" + gridColors["45-54"] + "'>  <b>45</b></span>" + " through" +"<span style='color:" + gridColors["55-64"] + "'>  <b>64</b></span>." + "<br><br>" +
      " <span style='background-color:" + gridColors["15-24"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " 15-24 &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["25-34"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " 25-34 &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["35-44"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " 35-44 &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["45-54"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " 45-54 &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["55-64"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " 55-64 &nbsp;&nbsp;" +
      " <span style='background-color:" + gridColors["65+"] +";'>&nbsp; &nbsp;&nbsp;</span>" + " 65+"
    ]

    const updateGridCaption = function(index){
      d3.select('#vis1_caption').html(gridCaptions[index]);
    }

    let vis1_index = 0;
    d3.select('#vis1_next').on("click", function(){
      if(vis1_index < 3){
        updateGridColors(vis1_index);
        updateGridCaption(vis1_index);
        if(vis1_index === 2){
          d3.select('#vis1_next').html("Restart")
        }
        vis1_index = vis1_index + 1;

      } else {
        vis1_index = 0;
        updateGridColors(vis1_index);
        updateGridCaption(vis1_index)
        d3.select('#vis1_next').html("Next")
      }

    })

// ========================================= END Vis 1 Grid Demographics

// County by county over Time ==========================================
    let names=[];
    const county_names=["Barnstable",
                  "Berkshire",
                  "Bristol",
                  "Dukes",
                  "Essex",
                  "Franklin",
                  "Hampden",
                  "Hampshire",
                  "Middlesex",
                  "Nantucket",
                  "Norfolk",
                  "Plymouth",
                  "Suffolk",
                  "Worcester"]

    const Data= d3.nest()
        .key(function(d) { return d.County; })
        .map(county_data);

    for (i=0; i<county_names.length; i++){
        const name=county_names[i];
        const selected=Data.get(name);

        const name_obj = {name:name, data:selected, color: null};
        names.push(name_obj)
    };
    function get_average(){
      let full=[];
      for (i=0; i<18; i++){
        let num=0;
        for (j=0; j<county_names.length; j++){
          num+=(+names[j].data[i]["DeathsPerCapita"])
        }
        let avgThisYear=num/county_names.length;
        selected={Year:(2000+i), DeathsPerCapita: avgThisYear};
        full.push(selected)
      }
      const name_obj = {name:"Average", data:full, color: null};
      names.push(name_obj)
    }
    get_average();



    // Sizing of counties over time
    const svgSteph = d3.select("#vis2")
      .attr("width", width+ margins.right + margins.left)
      .attr("height", height+ margins.top + margins.bottom);

    const chartSteph = svgSteph.append("g")
        .attr("transform", `translate(${margins.left}, ${margins.top-20})`);

    const svg2 = d3.select("#key")
        .attr("width", 300+ margins.right + margins.left)
        .attr("height", 300);
    const key = svg2.append("g")
        .attr("transform", `translate(${5}, ${margins.top})`);

    // Scales for counties over time
    var x_scale1 = d3.scaleLinear()
        .range([0,width])
        .domain([2000, 2017])
    var width_scale = d3.scaleLinear()
        .rangeRound([0, 10])
        .domain([d3.min(names, (d)=>+d.data[0]["Population"]), d3.max(names, (d)=>+d.data[0]["Population"])]);

    var y_scale1 = d3.scaleLinear()
        .range([height, 0])
        .domain([0,0.0005]);

    let color_scale_townlines=['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','gray','#bc80bd','#ccebc5','#ffed6f', '#fb9a99', '#a6cee3', 'black'];

    const line = d3.line()
        .x(function(d){return x_scale1(+d["Year"])})
        .y(function(d){return y_scale1(+d["DeathsPerCapita"])})

    //current set
    let current_lines=chartSteph.selectAll(".namelines")
    .data(names, (d)=>d)

    //exit set
    current_lines.exit().remove();

    //enter set
    let new_lines=current_lines.enter()
      .append("path")
      .attr("class", "namelines")
      .on('mouseover', function(d, i){
        // Tooltip
        const tooltip=d3.select("#tooltipSteph");

        tooltip.classed("hidden", false);
        const name=d.name;

        d3.select("#nameSteph").text(d.name);

        d3.select("#popSteph").text(+d.data[0]["Population"]);

        let currNum=i;
        const coordinates = [d3.event.pageX, d3.event.pageY];

        tooltip.style("left", (coordinates[0]+25) + "px");
        tooltip.style("top", (coordinates[1]+25) + "px");
        //------- END tooltip

        //new color stuff
        const curr = d3.select(this);
        let lines=chartSteph.selectAll(".namelines");

        lines.style('stroke', function(d, i) {
            if (i==currNum){
              return color_scale_townlines[i];
            }
            else{
              return "lightgray";
            }
         });
         lines.style('stroke-width', function(d, i) {
             if (i==currNum){
               return 7;
             }
             else{
               return 3;
             }
          });
      })
      .on('mouseout', function(d){
        const tooltip=d3.select("#tooltipSteph");
        tooltip.classed("hidden", true);
        let lines=chartSteph.selectAll(".namelines");

        lines.style('stroke', function(d, i) {
              return color_scale_townlines[i];
         });
         lines.style('stroke-width', function(d, i) {
           if (d.name==="Average"){
             return 5;
           }
           else{
              console.log("here")
               return 3;
             }
          });
      })

    current_lines=current_lines.merge(new_lines);

    current_lines.attr("d", (d)=>line(d.data))
        .style("stroke", function(d,i){

          return color_scale_townlines[i]})
        .style("fill", "none")
        .style('stroke-width', function(d) {
          if (d.name==="Average"){
            return 5;
          }
          else{
            return 3;
          }
        });


    d3.selectAll("#controls").on("change", function(){
     const option = d3.select(this);

     let curr_val=option.property("checked")


     let lines=chartSteph.selectAll(".namelines");

     if (curr_val==true){
       lines.style('stroke-width', function(d) {
           if (d.name==="Average"){

             return 5;
           }
           else{

             return width_scale(+d.data[0]["Population"]);
           }
        });
     }
     else{
       lines.style('stroke-width', function(d) {
           if (d.name==="Average"){
             return 5;
           }
           else{

             return 3;
           }
        });
     }
    });
    //current set for key
    let currentKey=key.selectAll("rect")
    .data(names, (d)=>d);

    //exit set for key
    currentKey.exit().remove();

    //enter set for key
    let newKey=currentKey
    .enter()
    .append("rect")

    currentKey=currentKey.merge(newKey);

    currentKey.attr('x',0)
    .attr('y',(d,i)=>i*20)
    .attr('width', 60)
    .attr('height', 20)
    .style("fill", (d, i)=>color_scale_townlines[i]);

    //current set for text
    let currentText=key.selectAll(".keytext")
    .data(names, (d)=>d);

    //exit set for text
    currentText.exit().remove();

    //enter set for text
    let newText=currentText
    .enter()
    .append("text")
    .attr("class", "keytext")
    .style("fill", "white");

    currentText=currentText.merge(newText);

    currentText.attr('x',0)
    .style("font-size", "0.8em")
    .attr('y',(d,i)=>(i*20)+12)
    .text((d)=>(d.name));

    // X axis
    chartSteph.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x_scale1).tickFormat(d3.format("d")))

    // Y axis
    let yaxis=chartSteph.append("g")
        .attr("class", "yaxis")
        .call(d3.axisLeft(y_scale1))

    // Add labels
    chartSteph.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${width/2}, ${height + margins.bottom})`)
        .text("Year");

    chartSteph.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${-(margins.left)*0.75}, ${height/2})rotate(-90)`)
        .text("Deaths by Overdose per Capita");

// ======================================= END County over Time
// ADD LEGEND TO MAP
const gradient_bar = d3.select('#gradient_bar')
      //Append a defs (for definition) element to your SVG
    var defs = gradient_bar.append("defs");

          //Append a linearGradient element to the defs and give it a unique id
    var linearGradient = defs.append("linearGradient")
         .attr("id", "linear-gradient");

           //Horizontal gradient
    linearGradient
         .attr("x1", "0%")
         .attr("y1", "0%")
         .attr("x2", "100%")
         .attr("y2", "0%");         

    linearGradient.selectAll("stop")
        .data( color_scale_map.range() )
        .enter().append("stop")
        .attr("offset", function(d,i) { return i/(color_scale_map.range().length-1); })
        .attr("stop-color", function(d) { return d; });

      //Draw the rectangle and fill with gradient
    gradient_bar.append("rect")
        .attr("width", 400)
        .attr("height", 20)
        .style("fill", "url(#linear-gradient)");

    const deaths_pc_min = color_scale_map.domain()[0];
    const deaths_pc_max =color_scale_map.domain()[1];
    d3.select('#grad_val1').html(deaths_pc_min.toPrecision(3))//min of deaths per Capita
    d3.select('#grad_val2').html("&nbsp; &nbsp; &nbsp; &nbsp;" + ((deaths_pc_max + deaths_pc_min)/2).toPrecision(3))
    d3.select('#grad_val3').html("&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp;&nbsp;" +deaths_pc_max.toPrecision(3))//20th percentile of deaths per Capita....

});
