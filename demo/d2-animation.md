## Deployment Pipeline

```d2
---
animate_interval: 1200
width: 80vw
layout: elk
title: Deployment pipeline
---
direction: right

title: {
  label: Normal deployment
  near: bottom-center
  shape: text
  style.font-size: 40
  style.underline: true
}

local: {
  code: {
    icon: https://icons.terrastruct.com/dev/go.svg
  }
}
local.code -> github.dev: commit

github: {
  icon: https://icons.terrastruct.com/dev/github.svg
  dev
  master: {
    workflows
  }

  dev -> master.workflows: merge trigger
}

github.master.workflows -> aws.builders: upload and run

aws: {
  builders -> s3: upload binaries
  ec2 <- s3: pull binaries

  builders: {
    icon: https://icons.terrastruct.com/aws/Developer%20Tools/AWS-CodeBuild_light-bg.svg
  }
  s3: {
    icon: https://icons.terrastruct.com/aws/Storage/Amazon-S3-Glacier_light-bg.svg
  }
  ec2: {
    icon: https://icons.terrastruct.com/aws/_Group%20Icons/EC2-instance-container_light-bg.svg
  }
}

local.code -> aws.ec2: {
  style.opacity: 0.0
}

scenarios: {
  hotfix: {
    title.label: Hotfix deployment
    (local.code -> github.dev)[0].style: {
      stroke: "#ca052b"
      opacity: 0.1
    }

    github: {
      dev: {
        style.opacity: 0.1
      }
      master: {
        workflows: {
          style.opacity: 0.1
        }
        style.opacity: 0.1
      }

      (dev -> master.workflows)[0].style.opacity: 0.1
      style.opacity: 0.1
      style.fill: "#ca052b"
    }

    (github.master.workflows -> aws.builders)[0].style.opacity: 0.1

    (local.code -> aws.ec2)[0]: {
      style.opacity: 1
      style.stroke-dash: 5
      style.stroke: "#167c3c"
    }
  }
}
```


## Water Cycle (Animated)

```d2
---
animate_interval: 1400
layout: elk
width: 80vw
title: Water cycle in nature
---
direction: right

title: {
  label: Water cycle in nature
  near: bottom-center
  shape: text
  style.font-size: 36
  style.underline: true
}

sun: {
  shape: circle
  style.fill: "#fde68a"
  style.stroke: "#f59e0b"
}

clouds: {
  shape: cloud
  style.fill: "#e2e8f0"
}

ocean: {
  shape: rectangle
  style.fill: "#bfdbfe"
  style.stroke: "#2563eb"
}

land: {
  shape: rectangle
  style.fill: "#bbf7d0"
  style.stroke: "#16a34a"
}

groundwater: {
  shape: cylinder
  style.fill: "#93c5fd"
}

sun -> ocean: evaporation
ocean -> clouds: water vapor
clouds -> land: precipitation
land -> groundwater: infiltration
groundwater -> ocean: runoff
land -> clouds: transpiration

scenarios: {
  storm: {
    title.label: Storm season
    (clouds -> land)[0].style: {
      stroke: "#1d4ed8"
      stroke-width: 5
    }
    (ocean -> clouds)[0].style: {
      stroke: "#0ea5e9"
      stroke-width: 5
    }
  }

  drought: {
    title.label: Drought season
    (clouds -> land)[0].style.opacity: 0.2
    (land -> groundwater)[0].style.opacity: 0.25
    (sun -> ocean)[0].style: {
      stroke: "#dc2626"
      stroke-width: 5
    }
  }
}
```
